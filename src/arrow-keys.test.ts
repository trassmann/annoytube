import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { routeArrowKeysToPlayer } from './arrow-keys';

const KEY_CODES = { ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 } as const;
type ArrowKey = keyof typeof KEY_CODES;
const ARROW_KEYS = Object.keys(KEY_CODES) as ArrowKey[];

/** Dispatches a key press the way the browser delivers a real one. */
function press(target: Element, key: ArrowKey, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    code: key,
    keyCode: KEY_CODES[key],
    which: KEY_CODES[key],
    bubbles: true,
    cancelable: true,
    composed: true,
    ...init,
  });
  // Only real key presses are routed; happy-dom has no notion of trusted events.
  Object.defineProperty(event, 'isTrusted', { value: true });
  target.dispatchEvent(event);
  return event;
}

/** Stands in for YouTube's player element: records the keys sent to it and cancels them. */
function mountPlayer(id: string, options: { muted?: boolean; handlesKeys?: boolean } = {}) {
  const { handlesKeys = true } = options;
  let muted = options.muted ?? false;
  const received: { key: string; keyCode: number; mutedOnArrival: boolean }[] = [];

  const player = Object.assign(document.createElement('div'), {
    id,
    isMuted: () => muted,
    unMute: () => {
      muted = false;
    },
  });
  player.addEventListener('keydown', (event) => {
    if (event.target !== player) return;
    received.push({ key: event.key, keyCode: event.keyCode, mutedOnArrival: muted });
    if (handlesKeys) event.preventDefault();
  });
  document.body.append(player);
  return { player, received, isMuted: () => muted };
}

function mount<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Record<string, string> = {},
  parent: Element = document.body,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  parent.append(element);
  return element;
}

let stopRouting: () => void;
/** Real key presses that got past the router to the page's own listeners. */
let reachedPage: KeyboardEvent[];
const recordIfReal = (event: Event) => {
  if (event.isTrusted) reachedPage.push(event as KeyboardEvent);
};

beforeEach(() => {
  history.replaceState(null, '', '/watch?v=dQw4w9WgXcQ');
  stopRouting = routeArrowKeysToPlayer();
  reachedPage = [];
  document.addEventListener('keydown', recordIfReal, { capture: true });
});

afterEach(() => {
  stopRouting();
  document.removeEventListener('keydown', recordIfReal, { capture: true });
  document.body.replaceChildren();
});

describe('on watch pages', () => {
  const focusTargets: [string, (player: HTMLElement) => Element][] = [
    ['the page', () => document.body],
    [
      'the volume slider',
      (player) => mount('div', { class: 'ytp-volume-panel', role: 'slider' }, player),
    ],
    [
      'the progress bar',
      (player) => mount('div', { class: 'ytp-progress-bar', role: 'slider' }, player),
    ],
    ['a player button', (player) => mount('button', {}, player)],
    ['the player itself', (player) => player],
    ['a link on the page', () => mount('a', { href: '/watch?v=other' })],
    ['a checkbox', () => mount('input', { type: 'checkbox' })],
  ];

  describe.each(focusTargets)('with focus on %s', (_, getTarget) => {
    it.each(ARROW_KEYS)('sends %s to the player instead', (key) => {
      const { player, received } = mountPlayer('movie_player');
      const event = press(getTarget(player), key);

      expect(received).toEqual([{ key, keyCode: KEY_CODES[key], mutedOnArrival: false }]);
      expect(event.defaultPrevented).toBe(true);
      expect(reachedPage).toEqual([]);
    });
  });

  it('treats /live/<id> links as watch pages', () => {
    history.replaceState(null, '', '/live/dQw4w9WgXcQ');
    const { received } = mountPlayer('movie_player');

    press(document.body, 'ArrowUp');

    expect(received.map((r) => r.key)).toEqual(['ArrowUp']);
  });

  it.each(['ArrowUp', 'ArrowDown'] as const)('unmutes before %s changes the volume', (key) => {
    const { received, isMuted } = mountPlayer('movie_player', { muted: true });

    press(document.body, key);

    expect(received).toEqual([{ key, keyCode: KEY_CODES[key], mutedOnArrival: false }]);
    expect(isMuted()).toBe(false);
  });

  it.each(['ArrowLeft', 'ArrowRight'] as const)('keeps the player muted when %s seeks', (key) => {
    const { isMuted } = mountPlayer('movie_player', { muted: true });

    press(document.body, key);

    expect(isMuted()).toBe(true);
  });

  it('still routes keys while the player API is not ready yet', () => {
    const player = mount('div', { id: 'movie_player' });
    const received: string[] = [];
    player.addEventListener('keydown', (event) => {
      received.push(event.key);
      event.preventDefault();
    });

    press(document.body, 'ArrowDown');

    expect(received).toEqual(['ArrowDown']);
  });
});

describe('leaves the arrow keys alone', () => {
  const ownArrowKeys: [string, () => Element][] = [
    ['a text field', () => mount('input', { type: 'text' })],
    ['the search box', () => mount('input', { type: 'search' })],
    ['an input without a type', () => mount('input')],
    ['a textarea', () => mount('textarea')],
    ['a select', () => mount('select')],
    ['a comment box', () => mount('span', {}, mount('div', { contenteditable: 'true' }))],
    ['an open menu', () => mount('div', { role: 'menuitem' }, mount('div', { role: 'menu' }))],
    ['a list box', () => mount('div', { role: 'option' }, mount('div', { role: 'listbox' }))],
  ];

  it.each(ownArrowKeys)('in %s', (_, getTarget) => {
    const { received } = mountPlayer('movie_player');

    for (const key of ARROW_KEYS) {
      const event = press(getTarget(), key);
      expect(event.defaultPrevented).toBe(false);
    }

    expect(received).toEqual([]);
    expect(reachedPage).toHaveLength(ARROW_KEYS.length);
  });

  it.each<[string, KeyboardEventInit]>([
    ['Shift', { shiftKey: true }],
    ['Ctrl', { ctrlKey: true }],
    ['Alt', { altKey: true }],
    ['Meta', { metaKey: true }],
    ['IME composition', { isComposing: true }],
  ])('with %s', (_, init) => {
    const { received } = mountPlayer('movie_player');

    press(document.body, 'ArrowLeft', init);

    expect(received).toEqual([]);
    expect(reachedPage).toHaveLength(1);
  });

  it.each(['/', '/results?search_query=cats', '/@YouTube', '/feed/subscriptions'])(
    'on %s',
    (path) => {
      history.replaceState(null, '', path);
      const { received } = mountPlayer('movie_player');

      press(document.body, 'ArrowUp');

      expect(received).toEqual([]);
      expect(reachedPage).toHaveLength(1);
    },
  );

  it('for synthetic key events', () => {
    const { received } = mountPlayer('movie_player');

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'ArrowLeft',
        keyCode: 37,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(received).toEqual([]);
  });

  it('when YouTube does not handle the forwarded key', () => {
    const { received } = mountPlayer('movie_player', { handlesKeys: false });

    const event = press(document.body, 'ArrowRight');

    expect(received.map((r) => r.key)).toEqual(['ArrowRight']);
    expect(event.defaultPrevented).toBe(false);
    expect(reachedPage).toEqual([event]);
  });

  it('once routing is stopped', () => {
    const { received } = mountPlayer('movie_player');
    stopRouting();

    press(document.body, 'ArrowUp');

    expect(received).toEqual([]);
  });
});

describe('on Shorts', () => {
  beforeEach(() => {
    history.replaceState(null, '', '/shorts/dQw4w9WgXcQ');
  });

  it.each(['ArrowLeft', 'ArrowRight'] as const)('sends %s to the Shorts player', (key) => {
    mountPlayer('movie_player');
    const shorts = mountPlayer('shorts-player');

    const event = press(document.body, key);

    expect(shorts.received.map((r) => r.key)).toEqual([key]);
    expect(event.defaultPrevented).toBe(true);
  });

  it.each(['ArrowUp', 'ArrowDown'] as const)('keeps %s for switching shorts', (key) => {
    const watch = mountPlayer('movie_player');
    const shorts = mountPlayer('shorts-player');

    const event = press(document.body, key);

    expect(shorts.received).toEqual([]);
    expect(watch.received).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });
});
