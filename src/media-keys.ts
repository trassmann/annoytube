/**
 * Makes "next track" and "previous track" work for YouTube videos, wherever they come from: headphone
 * gestures, the keyboard's media keys, or the OS's media controls. YouTube only offers them inside a
 * playlist; for every other video (and the "Add to queue" queue) it clears them, so they do nothing.
 *
 *   next      what the player's own "next" does: the next video of the playlist or queue, otherwise
 *             the video autoplay would play
 *   previous  back to the start once more than 3 s have played, otherwise the previous video of the
 *             playlist or queue, or else the video watched before this one in the tab
 *
 * Must run in the page's (MAIN) world before YouTube's scripts, so it sees YouTube's calls.
 */

import { isPlayingPlaylist, isWatchPage, videoIdOf, watchPagePlayer } from './youtube';

/** Like most music players, "previous" restarts a video that has played for longer than this. */
const RESTART_AFTER_SECONDS = 3;

const TRACK_ACTIONS: ReadonlySet<MediaSessionAction> = new Set(['nexttrack', 'previoustrack']);

/** The player to control: the watch page's, or the miniplayer while it plays a playlist or queue. */
function controlledPlayer() {
  const player = watchPagePlayer();
  return player && (isWatchPage() || isPlayingPlaylist(player)) ? player : null;
}

/** How many steps back in this tab's history the previous video is, if there is one. */
function stepsBackToPreviousVideo(): number {
  const current = navigation.currentEntry;
  if (!current) return 0;
  const currentVideo = videoIdOf(location.href);
  const entries = navigation.entries();
  for (let index = current.index - 1; index >= 0; index--) {
    const url = entries[index]?.url;
    const video = url ? videoIdOf(url) : null;
    if (video && video !== currentVideo) return current.index - index;
  }
  return 0;
}

/** @returns Whether this module handled it; if not, YouTube's own handler (if any) should. */
function playNext(): boolean {
  const player = controlledPlayer();
  if (!player?.nextVideo) return false;
  player.nextVideo();
  return true;
}

/** @returns Whether this module handled it; if not, YouTube's own handler (if any) should. */
function playPrevious(): boolean {
  const player = controlledPlayer();
  if (!player?.seekTo) return false;

  // Restarting a live stream would jump to the oldest part of it that can still be replayed.
  const canRestart = !player.getVideoData?.().isLive;
  const stepsBack = isWatchPage() ? stepsBackToPreviousVideo() : 0;

  if (canRestart && (player.getCurrentTime?.() ?? 0) > RESTART_AFTER_SECONDS) {
    player.seekTo(0, true);
  } else if ((player.getPlaylistIndex?.() ?? -1) > 0 && player.previousVideo) {
    player.previousVideo();
  } else if (stepsBack > 0) {
    // Like the browser's back button (rather than opening the video again), so pressing
    // "previous" again goes further back instead of returning to this video.
    history.go(-stepsBack);
  } else if (canRestart) {
    player.seekTo(0, true);
  }
  return true;
}

/**
 * Starts handling next/previous track. YouTube keeps setting its own handlers for them (or clearing
 * them), so those calls are intercepted and kept aside: they still run on pages this module leaves
 * alone, such as Shorts.
 *
 * @returns A function that stops it again and hands next/previous track back to YouTube.
 */
export function handleNextAndPreviousTrack(): () => void {
  const session = navigator.mediaSession;
  const setActionHandler = session.setActionHandler;
  const youtubeHandlers = new Map<MediaSessionAction, MediaSessionActionHandler | null>();

  session.setActionHandler = (action, handler) => {
    if (TRACK_ACTIONS.has(action)) youtubeHandlers.set(action, handler);
    else setActionHandler.call(session, action, handler);
  };
  setActionHandler.call(session, 'nexttrack', (details) => {
    if (!playNext()) youtubeHandlers.get('nexttrack')?.(details);
  });
  setActionHandler.call(session, 'previoustrack', (details) => {
    if (!playPrevious()) youtubeHandlers.get('previoustrack')?.(details);
  });

  return () => {
    session.setActionHandler = setActionHandler;
    for (const action of TRACK_ACTIONS) {
      setActionHandler.call(session, action, youtubeHandlers.get(action) ?? null);
    }
  };
}
