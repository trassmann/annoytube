/**
 * What the features share about YouTube's pages and player. None of it is a public API, so YouTube can
 * change any of it; every feature falls back to YouTube's own behaviour when something is missing.
 */

/** Methods YouTube adds to its player element. They may be missing while the player boots. */
export interface YouTubePlayer extends HTMLElement {
  getCurrentTime?: () => number;
  /** The video IDs of the playlist or queue being played, if any. */
  getPlaylist?: () => string[] | null;
  /** The position of the current video in that playlist or queue, or −1. */
  getPlaylistIndex?: () => number;
  getVideoData?: () => { isLive?: boolean };
  /** YouTube's data for the current watch page, including the video autoplay will play. */
  getWatchNextResponse?: () => unknown;
  isMuted?: () => boolean;
  /** What the player's "next" button and Shift+N do: the next playlist video, or YouTube's pick. */
  nextVideo?: () => void;
  previousVideo?: () => void;
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
  unMute?: () => void;
}

/** Whether `url` is a video's watch page (`/watch?v=…` or `/live/…`) rather than Shorts, a feed, … */
export function isWatchPage(url: { pathname: string } = location): boolean {
  return url.pathname === '/watch' || url.pathname.startsWith('/live/');
}

/** The video a watch page URL shows, if `url` is one. Relative URLs count as YouTube's. */
export function videoIdOf(url: string): string | null {
  const parsed = new URL(url, location.origin);
  if (parsed.origin !== location.origin || !isWatchPage(parsed)) return null;
  return parsed.searchParams.get('v') || parsed.pathname.split('/')[2] || null;
}

/** The player of the watch pages, which also plays in the miniplayer. Shorts have their own. */
export function watchPagePlayer(): YouTubePlayer | null {
  return document.getElementById('movie_player');
}

/** Whether `player` is playing a playlist, or a queue made with "Add to queue". */
export function isPlayingPlaylist(player: YouTubePlayer): boolean {
  return (player.getPlaylist?.()?.length ?? 0) > 0;
}
