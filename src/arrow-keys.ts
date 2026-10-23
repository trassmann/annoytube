/**
 * Sends the arrow keys to the YouTube player, so they always do what they do when the player
 * itself has focus, no matter which element (volume slider, progress bar, page, …) has it:
 *
 *   ← / →  seek −5 s / +5 s
 *   ↑ / ↓  volume +5 % / −5 % (unmuting first if muted)
 *
 * YouTube's own player handler does the actual work, so its on-screen feedback, clamping and
 * volume persistence all keep working. Must run in the page's (MAIN) world to reach the player API.
 */

/** Methods YouTube adds to its player element. They may be missing while the player boots. */
interface YouTubePlayer extends HTMLElement {
  isMuted?: () => boolean;
  unMute?: () => void;
}

const SEEK_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowRight']);
const VOLUME_KEYS: ReadonlySet<string> = new Set(['ArrowUp', 'ArrowDown']);

/** `<input>` types that don't use the arrow keys to edit text. */
const NON_TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/** Typing, and moving through an open menu or list, keep the arrow keys' usual meaning. */
function needsArrowKeys(target: EventTarget | undefined): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type);
  return target.closest('[role="menu"], [role="menubar"], [role="listbox"]') !== null;
}

/** The player that should receive `key` on the current page, if any. */
function findPlayer(key: string): YouTubePlayer | null {
  const { pathname } = location;
  if (pathname === '/watch' || pathname.startsWith('/live/')) {
    return document.getElementById('movie_player');
  }
  // On Shorts, ↑/↓ switch to the previous/next short (the player has no volume keys there),
  // so only seeking is routed.
  if (pathname.startsWith('/shorts/') && SEEK_KEYS.has(key)) {
    return document.getElementById('shorts-player');
  }
  return null;
}

function onKeyDown(event: KeyboardEvent): void {
  // Synthetic events (including the copies forwarded below) are never rerouted.
  if (!event.isTrusted || event.defaultPrevented || event.isComposing) return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  if (!SEEK_KEYS.has(event.key) && !VOLUME_KEYS.has(event.key)) return;
  if (needsArrowKeys(event.composedPath()[0])) return;

  const player = findPlayer(event.key);
  if (!player) return;

  if (VOLUME_KEYS.has(event.key) && player.isMuted?.()) player.unMute?.();

  const forwarded = new KeyboardEvent('keydown', {
    key: event.key,
    code: event.code,
    location: event.location,
    repeat: event.repeat,
    // YouTube's handler only looks at the legacy key codes.
    keyCode: event.keyCode,
    which: event.which,
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  player.dispatchEvent(forwarded);

  // YouTube cancels the keys it handles. If it didn't, leave the original key press alone.
  if (forwarded.defaultPrevented) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

/**
 * Starts routing arrow keys to the player. Listening on `window` in the capture phase, from
 * `document_start`, runs this before any of YouTube's own key handlers.
 *
 * @returns A function that stops the routing again.
 */
export function routeArrowKeysToPlayer(): () => void {
  window.addEventListener('keydown', onKeyDown, { capture: true });
  return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
}
