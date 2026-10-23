# Chrome Web Store listing

Copy for each tab of the [Developer Dashboard](https://chrome.google.com/webstore/devconsole). The
name and the short summary come from `src/manifest.json`.

## Store listing

**Description**

```text
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

Privacy: AnnoyTube runs only on www.youtube.com. It has no settings, needs no account, collects no data and makes no network requests.

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
Makes YouTube's arrow keys behave consistently: ← / → always seek 5 seconds and ↑ / ↓ always change the volume by 5 %, no matter which element on the page has focus.
```

**Host permission justification** (`https://www.youtube.com/*`)

```text
The extension is a single content script on www.youtube.com. It listens for arrow-key presses and hands them to YouTube's video player, so it needs access to YouTube pages. It runs on no other site.
```

- **Remote code:** No, I am not using remote code.
- **Data usage:** tick none of the data types, then tick the three certifications.
- **Privacy policy URL:** not required, because the extension handles no user data. If you want
  one anyway, publish this text somewhere public (a GitHub Gist works) and link it:

  ```text
  AnnoyTube does not collect, store, transmit or share any data. It runs only on www.youtube.com, where it reacts to arrow-key presses, and it makes no network requests.
  ```

## Distribution

- **Payments:** Free
- **Visibility:** Public (or Unlisted to try it with a few people first)
- **Regions:** All regions

## Test instructions

```text
No account or setup needed.
1. Open a YouTube video, for example https://www.youtube.com/watch?v=aqz-KE-bpKQ
2. Click the volume slider, then press ← or →: the video seeks 5 seconds (normally the volume would change).
3. Click the progress bar, then press ↑ or ↓: the volume changes by 5 % (normally the video would seek).
4. Click the page below the video, then press ↑ or ↓: the volume changes instead of the page scrolling.
```
