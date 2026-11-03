/**
 * Makes YouTube's "next video" the top video of the sidebar. YouTube picks the video autoplay plays
 * separately, and that one often isn't at the top of the sidebar, or anywhere in it.
 *
 * This covers everything that plays YouTube's pick: autoplay at the end of a video (whose "Up next"
 * countdown then shows the top video too), Shift+N, the player's next button and "next track" (see
 * media-keys.ts). Playlists and the queue keep their own order.
 *
 * Playlists, mixes, Shorts and ads in the sidebar are passed over, and so are videos already opened in
 * this tab, so that two videos that list each other first don't take turns forever.
 *
 * Must run in the page's (MAIN) world to reach the player API. Whenever something here doesn't find
 * what it expects, YouTube's own pick plays.
 */

import {
  isPlayingPlaylist,
  isWatchPage,
  videoIdOf,
  watchPagePlayer,
  type YouTubePlayer,
} from './youtube';

/** Where YouTube navigates to, as found in its page data and in its `yt-navigate` events. */
interface Endpoint {
  watchEndpoint?: { videoId?: unknown; params?: unknown; playerParams?: unknown };
  commandMetadata?: { webCommandMetadata?: { url?: unknown } };
}

/** The part of YouTube's watch page data that holds the video autoplay plays. */
interface WatchNextResponse {
  contents?: {
    twoColumnWatchNextResults?: {
      autoplay?: { autoplay?: { sets?: { autoplayVideo?: Endpoint }[] } };
    };
  };
}

interface RelatedVideo {
  videoId: string;
  /** The sidebar entry that shows the video. */
  entry: Element;
}

/** The "Up next in 8 …" countdown at the end of a video, which keeps its elements between videos. */
const COUNTDOWN = '.ytp-autonav-endscreen-countdown-overlay';
const COUNTDOWN_CHANGES: MutationObserverInit = {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['style', 'href'],
};

/** The video YouTube picked to play next, if the page data says. */
function youtubesPick(player: YouTubePlayer): string | null {
  const data = player.getWatchNextResponse?.() as WatchNextResponse | undefined;
  const sets = data?.contents?.twoColumnWatchNextResults?.autoplay?.autoplay?.sets;
  const videoId = sets?.[0]?.autoplayVideo?.watchEndpoint?.videoId;
  return typeof videoId === 'string' ? videoId : null;
}

/** The videos opened in this tab so far, including the current one, going by its history. */
function videosOpenedInThisTab(): Set<string> {
  const urls = [location.href, ...navigation.entries().map((entry) => entry.url ?? '')];
  return new Set(urls.map(videoIdOf).filter((videoId) => videoId !== null));
}

/** The first video in the sidebar that may play next. */
function topRelatedVideo(): RelatedVideo | null {
  const opened = videosOpenedInThisTab();
  // Shorts link to /shorts/…, so they never match.
  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    '#related a[href*="/watch?v="]',
  )) {
    if (link.closest('ytd-ad-slot-renderer')) continue;
    const url = new URL(link.href);
    const videoId = url.searchParams.get('v');
    // Playlists and mixes link to their first video, with the playlist in `list`.
    if (!videoId || url.searchParams.has('list') || opened.has(videoId)) continue;
    return {
      videoId,
      entry: link.closest('yt-lockup-view-model, ytd-compact-video-renderer') ?? link,
    };
  }
  return null;
}

/** The sidebar video to play instead of YouTube's pick, if they differ and the player is free to. */
function replacementFor(player: YouTubePlayer): { pick: string; next: RelatedVideo } | null {
  if (!isWatchPage() || isPlayingPlaylist(player)) return null;
  const pick = youtubesPick(player);
  if (!pick) return null;
  const next = topRelatedVideo();
  return next && next.videoId !== pick ? { pick, next } : null;
}

/** A copy of `endpoint` that opens `videoId` instead. */
function withVideo(endpoint: Endpoint, videoId: string): Endpoint {
  // `params` and `playerParams` say how to play it (as autoplay, …). The rest, prefetch and
  // streaming hints, are about YouTube's pick.
  const { params, playerParams } = endpoint.watchEndpoint ?? {};
  return {
    ...endpoint,
    watchEndpoint: { videoId, params, playerParams },
    commandMetadata: {
      ...endpoint.commandMetadata,
      webCommandMetadata: {
        ...endpoint.commandMetadata?.webCommandMetadata,
        url: `/watch?v=${videoId}`,
      },
    },
  };
}

/**
 * Whether a navigation was started by YouTube's "next video", rather than by choosing a video, which
 * may well be YouTube's pick too: in the sidebar, or among the end screen's videos.
 */
function isYouTubesNext(origin: Element): boolean {
  // Autoplay, Shift+N and `nextVideo()` start from the watch page element.
  if (origin.localName === 'ytd-watch-flexy') return true;
  // The countdown's "Play Now" and thumbnail start from the player, as the end screen's videos do,
  // but those only show when the countdown doesn't.
  const countdown = document.querySelector(COUNTDOWN);
  return (
    origin.localName === 'ytd-player' &&
    !!countdown &&
    getComputedStyle(countdown).display !== 'none'
  );
}

/** Sends YouTube's navigations to its own pick to the sidebar's top video instead. */
function redirectNextVideo(event: Event): void {
  if (!(event instanceof CustomEvent) || !(event.target instanceof Element)) return;
  if (!isYouTubesNext(event.target)) return;
  const detail: { endpoint?: Endpoint } | null = event.detail;
  const player = watchPagePlayer();
  const replacement = player && replacementFor(player);
  if (!detail?.endpoint || !replacement) return;
  if (detail.endpoint.watchEndpoint?.videoId !== replacement.pick) return;
  detail.endpoint = withVideo(detail.endpoint, replacement.next.videoId);
}

function setText(root: Element, selector: string, text: string): void {
  const element = root.querySelector(selector);
  if (element && element.textContent !== text) element.textContent = text;
}

/** Fills the countdown with `video`, from its sidebar entry, instead of YouTube's pick. */
function showInCountdown(countdown: Element, { videoId, entry }: RelatedVideo): void {
  const text = (selector: string) => entry.querySelector(selector)?.textContent?.trim() ?? '';
  const [channel = '', viewsAndDate = ''] = Array.from(
    entry.querySelectorAll('yt-content-metadata-view-model > div'),
    (row) => row.textContent?.trim() ?? '',
  );
  setText(countdown, '.ytp-autonav-endscreen-upnext-title', text('h3'));
  setText(countdown, '.ytp-autonav-endscreen-upnext-author', channel);
  setText(countdown, '.ytp-autonav-view-and-date', viewsAndDate);
  setText(countdown, '.ytp-autonav-author-and-view', channel);
  setText(countdown, '.ytp-autonav-timestamp', text('yt-thumbnail-badge-view-model'));

  const url = new URL(`/watch?v=${videoId}`, location.origin).href;
  for (const link of countdown.querySelectorAll('a')) {
    if (link.href !== url) link.href = url;
  }
  const thumbnail = countdown.querySelector<HTMLElement>('.ytp-autonav-endscreen-upnext-thumbnail');
  const image =
    entry.querySelector('img')?.src || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
  if (thumbnail) thumbnail.style.backgroundImage = `url("${image}")`;
}

/**
 * Starts playing the sidebar's top video next, instead of YouTube's pick.
 *
 * @returns A function that stops it again.
 */
export function playTopRelatedNext(): () => void {
  let countdown: Element | null = null;
  const observer = new MutationObserver(updateCountdown);

  // YouTube fills in the countdown a while into each video, and again when it shows it at the end,
  // by which time the sidebar may have changed. So it is updated whenever YouTube changes it.
  function updateCountdown(): void {
    const player = watchPagePlayer();
    const replacement = player && replacementFor(player);
    if (!countdown || !replacement) return;
    // Not watching while changing it keeps these changes from calling this again.
    observer.disconnect();
    showInCountdown(countdown, replacement.next);
    observer.observe(countdown, COUNTDOWN_CHANGES);
  }

  function findCountdown(): void {
    const found = document.querySelector(COUNTDOWN);
    if (found !== countdown) {
      observer.disconnect();
      countdown = found;
      if (countdown) observer.observe(countdown, COUNTDOWN_CHANGES);
    }
    updateCountdown();
  }

  window.addEventListener('yt-navigate', redirectNextVideo, { capture: true });
  // The player, and with it the countdown, exists once a page has loaded, and certainly once a
  // video ends.
  document.addEventListener('yt-navigate-finish', findCountdown);
  window.addEventListener('ended', findCountdown, { capture: true });

  return () => {
    window.removeEventListener('yt-navigate', redirectNextVideo, { capture: true });
    document.removeEventListener('yt-navigate-finish', findCountdown);
    window.removeEventListener('ended', findCountdown, { capture: true });
    observer.disconnect();
  };
}
