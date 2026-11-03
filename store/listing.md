# Chrome Web Store listing

Copy for each tab of the [Developer Dashboard](https://chrome.google.com/webstore/devconsole). The
name and the short summary come from `src/manifest.json`.

## Store listing

**Description**

```text
AnnoyTube fixes three things YouTube gets in the way of: the arrow keys, next/previous track, and what autoplay plays.

ARROW KEYS THAT IGNORE FOCUS

YouTube hands your arrow keys to whatever you clicked last. Click the volume slider and ← → change the volume instead of seeking. Click the progress bar and ↑ ↓ seek instead of changing the volume. Click anywhere on the page and ↑ ↓ scroll it.

AnnoyTube makes the arrow keys do the same thing no matter what has focus:

• ← / → seek back / forward 5 seconds
• ↑ / ↓ turn the volume up / down by 5 % (and unmute if muted)

Every arrow key goes to YouTube's own player, so you still see YouTube's volume and seek indicators, and the volume you pick is remembered like any other change.

Still works as usual:
• Typing in the search box or a comment
• Open menus, such as the player's settings
• Shortcuts with Shift, Ctrl, Alt or ⌘
• Shorts: ← / → seek, ↑ / ↓ still switch between Shorts

NEXT AND PREVIOUS TRACK

YouTube only lets "next track" and "previous track" skip videos inside a playlist. Everywhere else, your headphone gestures, your keyboard's media keys and your computer's media controls do nothing. With AnnoyTube they skip between videos, like they skip songs in a music player:

• Next: the next video of the playlist or queue, otherwise the video autoplay would play
• Previous: back to the start once more than 3 seconds have played, otherwise the previous video

AUTOPLAY PLAYS THE TOP VIDEO OF THE SIDEBAR

YouTube picks the video autoplay plays separately, and it often isn't the one at the top of the sidebar. AnnoyTube makes autoplay play the top video instead, and the "Up next" countdown shows it. So do Shift+N and "next track". Playlists, mixes, Shorts, ads and videos you already opened in the tab are skipped.

Playlists and the queue (⋮ → Add to queue) keep their own order, and turning autoplay off still turns it off.

Privacy: AnnoyTube runs only on www.youtube.com. It has no settings, needs no account, and collects and sends no data.

AnnoyTube is not affiliated with or endorsed by YouTube or Google.
```

- **Category:** Functionality & UI (or the closest match in the dropdown)
- **Language:** English
- **Store icon:** `src/icons/icon-128.png`
- **Screenshots:** `store/screenshot-1.png`, `store/screenshot-2.png`
- **Small promo tile:** `store/promo-small.png`
- **Homepage and support URLs:** optional. The GitHub repository is private, so leave them empty
  or make the repository public first.

## Privacy

**Single purpose**

```text
Makes YouTube's playback controls do what you expect: ← / → always seek 5 seconds and ↑ / ↓ always change the volume by 5 %, no matter which element on the page has focus; next/previous track (headphones, media keys) skip between videos; and autoplay plays the top video of the sidebar.
```

**Host permission justification** (`https://www.youtube.com/*`)

```text
The extension is a single content script on www.youtube.com. It hands arrow-key presses to YouTube's video player, handles the next/previous track controls of YouTube's media session, and tells YouTube's autoplay which video to open, so it needs access to YouTube pages. It runs on no other site.
```

- **Remote code:** No, I am not using remote code.
- **Data usage:** tick none of the data types, then tick the three certifications.
- **Privacy policy URL:** not required, because the extension handles no user data. If you want
  one anyway, publish this text somewhere public (a GitHub Gist works) and link it:

  ```text
  AnnoyTube does not collect, store, transmit or share any data. It runs only on www.youtube.com, where it changes what the arrow keys, the next/previous track controls and autoplay do.
  ```

## Distribution

- **Payments:** Free
- **Visibility:** Public (or Unlisted to try it with a few people first)
- **Regions:** All regions

## Test instructions

```text
No account or setup needed.

Arrow keys:
1. Open a YouTube video, for example https://www.youtube.com/watch?v=aqz-KE-bpKQ
2. Click the volume slider, then press ← or →: the video seeks 5 seconds (normally the volume would change).
3. Click the progress bar, then press ↑ or ↓: the volume changes by 5 % (normally the video would seek).
4. Click the page below the video, then press ↑ or ↓: the volume changes instead of the page scrolling.

Next and previous track:
5. Press the keyboard's "next track" media key, or the next button in Chrome's media controls (the music note in the toolbar): the next video opens (normally nothing happens outside a playlist).
6. Wait a few seconds, then press "previous track": the video restarts. Press it again right away: the previous video opens.

Autoplay:
7. Open https://www.youtube.com/watch?v=jNQXAC9IVRw (19 seconds long) and let it play to the end: the "Up next" countdown shows the first video in the sidebar (normally it is often a different one), and that video plays next.
```
