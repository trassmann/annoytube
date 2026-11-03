# AnnoyTube

A minimal Manifest V3 extension for Brave (or any Chromium browser) that fixes three things YouTube
gets in the way of: the arrow keys, next/previous track, and what autoplay plays.

## Arrow keys

The arrow keys do the same thing no matter which element has focus.

| Key | Watch pages (`/watch`, `/live/…`)          | Shorts                         |
| --- | ------------------------------------------ | ------------------------------ |
| ←/→ | seek −5 s / +5 s                           | seek −5 s / +5 s               |
| ↑/↓ | volume +5 % / −5 % (unmutes, clamps 0–100) | unchanged: previous/next short |

Without it, YouTube gives the arrow keys to whatever has focus: with the volume slider focused,
←/→ change the volume; with the progress bar focused, ↑/↓ seek; with the page focused, ↑/↓
scroll.

The arrow keys keep their usual meaning while you type (search box, comments), inside an open
menu or list (the player's settings menu, for example), and when combined with Shift, Ctrl, Alt
or ⌘.

## Next and previous track

Headphone gestures, the keyboard's media keys and the OS's media controls (Control Center, the
lock screen, …) skip between videos, the way they skip songs in a music player:
- **Next** plays the next video of the playlist or queue, otherwise the video autoplay would play.
- **Previous** restarts the video once it has played for more than 3 s. Otherwise it plays the
  previous video of the playlist or queue, or else goes back to the video you watched before this
  one in the tab. It never restarts a live stream.

Without it, YouTube only supports them inside playlists. For any other video, and for the queue,
they do nothing.

## Autoplay plays the top video of the sidebar

YouTube picks the video autoplay plays separately from the sidebar, and it often isn't the one at
the top, or anywhere in it. With AnnoyTube, autoplay plays the sidebar's top video, and the "Up
next" countdown at the end of a video shows it. So do Shift+N and "next track".

The top video leaves out playlists and mixes, Shorts, ads, and videos already opened in the tab,
so that two videos that list each other first can't send you back and forth.

Playlists and the queue keep their own order. To pick what plays next yourself, use YouTube's
queue: **⋮ → Add to queue** on any video. Turning autoplay off still turns it off.

## Install

```sh
pnpm install
pnpm build
```

Then open `brave://extensions`, turn on **Developer mode**, click **Load unpacked** and select the
`dist` folder. After rebuilding, click the extension's reload button and refresh YouTube.

## Development

| Command      | What it does                                     |
| ------------ | ------------------------------------------------ |
| `pnpm dev`   | Rebuilds `dist/` on every change                 |
| `pnpm test`  | Runs the unit tests (Vitest + happy-dom)         |
| `pnpm check` | Lint and format check (Biome), type check, tests |
| `pnpm fix`   | Applies Biome's formatting and safe lint fixes   |
| `pnpm zip`   | Clean build, packed into `annoytube.zip`         |

## Publishing to the Chrome Web Store

1. Bump `version` in [`src/manifest.json`](src/manifest.json).
2. Run `pnpm zip`.
3. Upload `annoytube.zip` in the
   [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), then
   submit it for review.

The listing copy, privacy answers and images are in [`store/`](store).

## How it works

A single content script ([`src/content.ts`](src/content.ts)) runs in the page's `MAIN` world from
`document_start`, so it can use YouTube's player API and is in place before YouTube's own scripts
run. Each feature relies on YouTube's own behaviour as far as possible. If YouTube changes
something a feature relies on, that feature falls back to YouTube's stock behaviour.

**Arrow keys** ([`src/arrow-keys.ts`](src/arrow-keys.ts)). A `keydown` listener on `window`, in the
capture phase, runs before any of YouTube's handlers. For each arrow key it sends a copy of the key
press to the player element and swallows the original, so YouTube handles the key as if the player
had focus. That keeps YouTube's own on-screen feedback and saves the volume like any other change;
calling `player.setVolume()` directly would not, and the volume would reset on the next page load.
For ↑/↓ the script unmutes the player first, because YouTube's own handler changes the volume of a
muted player without unmuting it. If YouTube ever stops handling the forwarded key, the original
key press goes through untouched.

**Next and previous track** ([`src/media-keys.ts`](src/media-keys.ts)). The browser hands these to
the page's [Media Session](https://developer.mozilla.org/docs/Web/API/Media_Session_API) action
handlers, which YouTube sets to `null` outside playlists. The script intercepts YouTube's calls to
`navigator.mediaSession.setActionHandler` for these two actions and keeps its own handlers
registered instead. Next calls the player's `nextVideo()`, which is what its next button and
Shift+N do. Previous goes back with `history.go()`, like the back button, so pressing it again goes
further back. On pages the script leaves alone, such as Shorts, YouTube's own handlers run.

**Autoplay** ([`src/up-next.ts`](src/up-next.ts)). YouTube navigates by firing a `yt-navigate`
event. When the event goes to YouTube's pick and comes from YouTube's "next video" (the watch page
element for autoplay, Shift+N and `nextVideo()`, or the player while the countdown shows), the
script swaps in the sidebar's top video before YouTube's router reads it. A click on a video starts
from somewhere else, so choosing YouTube's pick yourself (in the sidebar, or on the end screen
when autoplay is off) still opens it. The countdown is filled in from the sidebar entry whenever
YouTube fills it in.

Known limitation: arrow keys pressed while focus is inside the live chat (an iframe) stay in the
chat.
