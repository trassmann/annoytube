import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { handleNextAndPreviousTrack } from './media-keys';

/** Stands in for the browser's media session: remembers the handlers the page leaves registered. */
function installMediaSession() {
  const registered = new Map<MediaSessionAction, MediaSessionActionHandler | null>();
  const session = {
    setActionHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null) {
      registered.set(action, handler);
    },
  };
  Object.defineProperty(navigator, 'mediaSession', { value: session, configurable: true });
  return {
    /** What YouTube's player does: it goes through `navigator.mediaSession`, like any page script. */
    youtubeSets: (action: MediaSessionAction, handler: MediaSessionActionHandler | null) =>
      navigator.mediaSession.setActionHandler(action, handler),
    /** What a headphone gesture or media key does. */
    press: (action: MediaSessionAction) => registered.get(action)?.({ action }),
    registered,
  };
}

/** Stands in for YouTube's player element: records what it is asked to do. */
function mountPlayer(
  options: { time?: number; playlist?: string[]; playlistIndex?: number; isLive?: boolean } = {},
) {
  const calls: string[] = [];
  const player = Object.assign(document.createElement('div'), {
    id: 'movie_player',
    getCurrentTime: () => options.time ?? 0,
    getPlaylist: () => options.playlist ?? null,
    getPlaylistIndex: () => options.playlistIndex ?? -1,
    getVideoData: () => ({ isLive: options.isLive ?? false }),
    nextVideo: () => calls.push('nextVideo'),
    previousVideo: () => calls.push('previousVideo'),
    seekTo: (seconds: number) => calls.push(`seekTo ${seconds}`),
  });
  document.body.append(player);
  return calls;
}

/** Makes this tab's history `paths`, currently at the last one (or at `current`). */
function setHistory(paths: string[], current = paths.length - 1) {
  const entries = paths.map((path, index) => ({
    url: new URL(path, location.origin).href,
    index,
    key: `key-${index}`,
  }));
  vi.stubGlobal('navigation', { entries: () => entries, currentEntry: entries[current] });
  history.replaceState(null, '', paths[current]);
}

let session: ReturnType<typeof installMediaSession>;
let stop: () => void;
let historyGo: MockInstance<History['go']>;

beforeEach(() => {
  setHistory(['/watch?v=current']);
  historyGo = vi.spyOn(history, 'go').mockImplementation(() => {});
  session = installMediaSession();
  stop = handleNextAndPreviousTrack();
});

afterEach(() => {
  stop();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

it('keeps next and previous track available when YouTube clears them', () => {
  const calls = mountPlayer();

  // What YouTube does for every video outside a playlist.
  session.youtubeSets('nexttrack', null);
  session.youtubeSets('previoustrack', null);
  session.press('nexttrack');

  expect(calls).toEqual(['nextVideo']);
  expect(session.registered.get('previoustrack')).toBeTypeOf('function');
});

it('leaves the other media actions to YouTube', () => {
  const play = () => {};

  session.youtubeSets('play', play);

  expect(session.registered.get('play')).toBe(play);
});

describe('next track', () => {
  it("does what the player's next button does", () => {
    const calls = mountPlayer();

    session.press('nexttrack');

    expect(calls).toEqual(['nextVideo']);
  });

  it('also plays the next video of a playlist or queue', () => {
    const calls = mountPlayer({ playlist: ['current', 'queued'], playlistIndex: 0 });

    session.press('nexttrack');

    expect(calls).toEqual(['nextVideo']);
  });

  it('works in the miniplayer while it plays a queue', () => {
    setHistory(['/watch?v=current', '/feed/subscriptions']);
    const calls = mountPlayer({ playlist: ['current', 'queued'], playlistIndex: 0 });

    session.press('nexttrack');

    expect(calls).toEqual(['nextVideo']);
  });
});

describe('previous track', () => {
  it('restarts a video that has played for more than 3 s', () => {
    setHistory(['/watch?v=before', '/watch?v=current']);
    const calls = mountPlayer({ time: 3.5, playlist: ['a', 'current'], playlistIndex: 1 });

    session.press('previoustrack');

    expect(calls).toEqual(['seekTo 0']);
    expect(historyGo).not.toHaveBeenCalled();
  });

  it('plays the previous video of a playlist or queue', () => {
    const calls = mountPlayer({ time: 2, playlist: ['a', 'current'], playlistIndex: 1 });

    session.press('previoustrack');

    expect(calls).toEqual(['previousVideo']);
  });

  it('goes back to the video watched before, skipping other pages', () => {
    setHistory(['/watch?v=before', '/results?search_query=cats', '/watch?v=current']);
    const calls = mountPlayer({ time: 2 });

    session.press('previoustrack');

    expect(historyGo).toHaveBeenCalledWith(-2);
    expect(calls).toEqual([]);
  });

  it('skips earlier visits of the current video', () => {
    setHistory(['/watch?v=before', '/watch?v=current', '/watch?v=current&t=90']);
    mountPlayer({ time: 1 });

    session.press('previoustrack');

    expect(historyGo).toHaveBeenCalledWith(-2);
  });

  it('only looks back in history, not forward', () => {
    setHistory(['/', '/watch?v=current', '/watch?v=after'], 1);
    const calls = mountPlayer({ time: 1 });

    session.press('previoustrack');

    expect(historyGo).not.toHaveBeenCalled();
    expect(calls).toEqual(['seekTo 0']);
  });

  it('restarts the first video watched in the tab', () => {
    setHistory(['/', '/watch?v=current']);
    const calls = mountPlayer({ time: 1 });

    session.press('previoustrack');

    expect(calls).toEqual(['seekTo 0']);
  });

  it('never restarts a live stream', () => {
    const calls = mountPlayer({ time: 3600, isLive: true });

    session.press('previoustrack');

    expect(calls).toEqual([]);
  });

  it('goes back from a live stream to the video watched before', () => {
    setHistory(['/watch?v=before', '/live/current']);
    mountPlayer({ time: 3600, isLive: true });

    session.press('previoustrack');

    expect(historyGo).toHaveBeenCalledWith(-1);
  });

  it('stays on the page in the miniplayer', () => {
    setHistory(['/watch?v=before', '/watch?v=current', '/']);
    const calls = mountPlayer({ time: 1, playlist: ['current', 'queued'], playlistIndex: 0 });

    session.press('previoustrack');

    expect(historyGo).not.toHaveBeenCalled();
    expect(calls).toEqual(['seekTo 0']);
  });
});

describe('leaves next and previous track to YouTube', () => {
  it.each(['/shorts/abc', '/', '/results?search_query=cats'])('on %s', (path) => {
    setHistory(['/watch?v=before', path]);
    const calls = mountPlayer();
    const youtubeNext = vi.fn();
    session.youtubeSets('nexttrack', youtubeNext);

    session.press('nexttrack');
    session.press('previoustrack');

    expect(youtubeNext).toHaveBeenCalledWith({ action: 'nexttrack' });
    expect(calls).toEqual([]);
    expect(historyGo).not.toHaveBeenCalled();
  });

  it('while the player is still loading', () => {
    const youtubeNext = vi.fn();
    session.youtubeSets('nexttrack', youtubeNext);

    session.press('nexttrack');

    expect(youtubeNext).toHaveBeenCalled();
  });

  it('once stopped', () => {
    const youtubeNext = () => {};
    session.youtubeSets('nexttrack', youtubeNext);
    session.youtubeSets('previoustrack', null);

    stop();
    const youtubePrevious = () => {};
    session.youtubeSets('previoustrack', youtubePrevious);

    expect(session.registered.get('nexttrack')).toBe(youtubeNext);
    expect(session.registered.get('previoustrack')).toBe(youtubePrevious);
  });
});
