# AnnoyTube

A minimal Manifest V3 extension for Brave (or any Chromium browser) that makes YouTube's arrow keys
do the same thing no matter which element has focus.

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

## How it works

A single content script ([`src/arrow-keys.ts`](src/arrow-keys.ts)) runs in the page's `MAIN`
world from `document_start`. Its `keydown` listener on `window`, in the capture phase, runs before
any of YouTube's handlers. For each arrow key it sends a copy of the key press to the player
element and swallows the original, so YouTube handles the key as if the player had focus. That
keeps YouTube's own on-screen feedback and saves the volume like any other change; calling
`player.setVolume()` directly would not, and the volume would reset on the next page load. For
↑/↓ the script unmutes the player first, because YouTube's own handler changes the volume of a
muted player without unmuting it.

If YouTube ever stops handling the forwarded key, the original key press goes through untouched,
so the worst case is YouTube's stock behaviour.

Known limitation: keys pressed while focus is inside the live chat (an iframe) stay in the chat.
