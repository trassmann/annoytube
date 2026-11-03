import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playTopRelatedNext } from './up-next';

interface Endpoint {
  watchEndpoint: Record<string, unknown>;
  commandMetadata: { webCommandMetadata: Record<string, unknown> };
  clickTrackingParams?: string;
}

/** YouTube's own pick for autoplay, from its page data. */
const YOUTUBES_PICK = 'youtubePick';

/** Makes this tab's history `paths`, currently at the last one. */
function setHistory(...paths: string[]) {
  const entries = paths.map((path, index) => ({ url: new URL(path, location.origin).href, index }));
  vi.stubGlobal('navigation', { entries: () => entries, currentEntry: entries.at(-1) });
  history.replaceState(null, '', paths.at(-1));
}

/** Stands in for the watch page and its player (with the parts of the countdown used here). */
function mountWatchPage(options: { pick?: string | null; playlist?: string[] } = {}) {
  const { pick = YOUTUBES_PICK, playlist = null } = options;
  const watchPage = document.createElement('ytd-watch-flexy');
  const player = Object.assign(document.createElement('div'), {
    id: 'movie_player',
    getPlaylist: () => playlist,
    getWatchNextResponse: () => ({
      contents: {
        twoColumnWatchNextResults: {
          autoplay: {
            autoplay: { sets: [{ autoplayVideo: { watchEndpoint: { videoId: pick } } }] },
          },
        },
      },
    }),
  });
  player.innerHTML = `
    <div class="ytp-autonav-endscreen-countdown-overlay" style="display: none">
      <div class="ytp-autonav-endscreen-upnext-header">Up next</div>
      <a class="ytp-autonav-endscreen-link-container" href="https://www.youtube.com/watch?v=${pick}">
        <div class="ytp-autonav-endscreen-upnext-thumbnail"
             style="background-image: url(&quot;https://i.ytimg.com/vi/${pick}/hqdefault.jpg&quot;)">
          <div class="ytp-autonav-timestamp">19:02</div>
        </div>
        <div class="ytp-autonav-endscreen-upnext-title">YouTube's pick</div>
        <div class="ytp-autonav-endscreen-upnext-author">Some channel</div>
        <div class="ytp-autonav-view-and-date">11M • 3mo ago</div>
        <div class="ytp-autonav-author-and-view">Some channel • 11M</div>
      </a>
      <a class="ytp-autonav-endscreen-upnext-play-button" href="https://www.youtube.com/watch?v=${pick}">Play Now</a>
    </div>`;
  const playerHost = document.createElement('ytd-player');
  playerHost.append(player);
  const related = Object.assign(document.createElement('div'), { id: 'related' });
  watchPage.append(playerHost, related);
  document.body.append(watchPage);
  const countdown = player.querySelector<HTMLElement>('.ytp-autonav-endscreen-countdown-overlay');
  /** What YouTube does at the end of a video when autoplay is on. */
  const showCountdown = () => countdown?.style.removeProperty('display');
  return { watchPage, playerHost, related, showCountdown };
}

/** A sidebar entry, shaped like YouTube's (`yt-lockup-view-model`). */
function lockup(href: string, title = 'A video') {
  const entry = document.createElement('yt-lockup-view-model');
  entry.innerHTML = `
    <a href="${href}"><img src="https://i.ytimg.com/vi/thumbnail.jpg">
      <yt-thumbnail-badge-view-model>16:31</yt-thumbnail-badge-view-model></a>
    <h3><a href="${href}">${title}</a></h3>
    <yt-content-metadata-view-model><div>The Channel</div><div>1.7M 2w ago</div></yt-content-metadata-view-model>`;
  return entry;
}

/** A sidebar ad, linking to a video. */
function ad(href: string) {
  const slot = document.createElement('ytd-ad-slot-renderer');
  slot.innerHTML = `<a href="${href}">Sponsored</a>`;
  return slot;
}

/** Dispatches a `yt-navigate` event like YouTube does, returning where it ends up going. */
function navigate(from: Element, videoId: string): Endpoint {
  const endpoint: Endpoint = {
    watchEndpoint: {
      videoId,
      params: 'autoplay-params',
      playerParams: 'autoplay-player-params',
      watchEndpointSupportedPrefetchConfig: { prefetchHintConfig: {} },
    },
    commandMetadata: {
      webCommandMetadata: { url: `/watch?v=${videoId}`, webPageType: 'WEB_PAGE_TYPE_WATCH' },
    },
    clickTrackingParams: 'tracking',
  };
  const detail = { endpoint };
  from.dispatchEvent(new CustomEvent('yt-navigate', { bubbles: true, composed: true, detail }));
  return detail.endpoint;
}

const destination = (endpoint: Endpoint) => endpoint.watchEndpoint.videoId;

let stop: () => void;

beforeEach(() => {
  setHistory('/watch?v=current');
  stop = playTopRelatedNext();
});

afterEach(() => {
  stop();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("YouTube's next video", () => {
  it("is the top video of the sidebar instead of YouTube's pick", () => {
    const { watchPage, related } = mountWatchPage();
    related.append(
      lockup('/watch?v=top'),
      lockup('/watch?v=second'),
      lockup(`/watch?v=${YOUTUBES_PICK}`),
    );

    const endpoint = navigate(watchPage, YOUTUBES_PICK);

    expect(endpoint).toEqual({
      watchEndpoint: {
        videoId: 'top',
        params: 'autoplay-params',
        playerParams: 'autoplay-player-params',
      },
      commandMetadata: {
        webCommandMetadata: { url: '/watch?v=top', webPageType: 'WEB_PAGE_TYPE_WATCH' },
      },
      clickTrackingParams: 'tracking',
    });
  });

  it.each<[string, () => Element]>([
    ['mixes and playlists', () => lockup('/watch?v=mix&list=RDmix&start_radio=1')],
    ['Shorts', () => lockup('/shorts/short')],
    ['ads', () => ad('/watch?v=sponsored')],
    ['the current video', () => lockup('/watch?v=current')],
  ])('passes over %s', (_, makeEntry) => {
    const { watchPage, related } = mountWatchPage();
    related.append(makeEntry(), lockup('/watch?v=video&pp=tracking'));

    expect(destination(navigate(watchPage, YOUTUBES_PICK))).toBe('video');
  });

  it('passes over videos already opened in this tab', () => {
    setHistory('/watch?v=earlier', '/', '/watch?v=current');
    const { watchPage, related } = mountWatchPage();
    related.append(lockup('/watch?v=earlier'), lockup('/watch?v=new'));

    expect(destination(navigate(watchPage, YOUTUBES_PICK))).toBe('new');
  });

  it('works on /live/<id> pages', () => {
    setHistory('/live/current');
    const { watchPage, related } = mountWatchPage();
    related.append(lockup('/watch?v=current'), lockup('/watch?v=top'));

    expect(destination(navigate(watchPage, YOUTUBES_PICK))).toBe('top');
  });
});

describe("keeps YouTube's pick", () => {
  it('when the user clicks it in the sidebar', () => {
    const { related } = mountWatchPage();
    related.append(lockup('/watch?v=top'), lockup(`/watch?v=${YOUTUBES_PICK}`));
    const link = related.querySelectorAll('a')[2] as Element;

    expect(destination(navigate(link, YOUTUBES_PICK))).toBe(YOUTUBES_PICK);
  });

  it.each([
    ['in a playlist or the queue', { playlist: ['current', 'next'] }],
    ['when the page data has no pick', { pick: null }],
  ])('%s', (_, options) => {
    const { watchPage, related } = mountWatchPage(options);
    related.append(lockup('/watch?v=top'));

    expect(destination(navigate(watchPage, YOUTUBES_PICK))).toBe(YOUTUBES_PICK);
  });

  it('when the sidebar has no video left to play', () => {
    setHistory('/watch?v=earlier', '/watch?v=current');
    const { watchPage, related } = mountWatchPage();
    related.append(lockup('/watch?v=earlier'), lockup('/shorts/short'));

    expect(destination(navigate(watchPage, YOUTUBES_PICK))).toBe(YOUTUBES_PICK);
  });

  it('once stopped', () => {
    const { watchPage, related } = mountWatchPage();
    related.append(lockup('/watch?v=top'));
    stop();

    expect(destination(navigate(watchPage, YOUTUBES_PICK))).toBe(YOUTUBES_PICK);
  });

  it('on other pages', () => {
    setHistory('/watch?v=current', '/feed/subscriptions');
    const { watchPage, related } = mountWatchPage();
    related.append(lockup('/watch?v=top'));

    expect(destination(navigate(watchPage, YOUTUBES_PICK))).toBe(YOUTUBES_PICK);
  });
});

describe("the countdown's Play Now and thumbnail", () => {
  it('play the top video of the sidebar too', () => {
    const { playerHost, related, showCountdown } = mountWatchPage();
    related.append(lockup('/watch?v=top'));

    showCountdown();

    expect(destination(navigate(playerHost, YOUTUBES_PICK))).toBe('top');
  });

  it("don't change the videos on the end screen, which may include YouTube's pick", () => {
    const { playerHost, related } = mountWatchPage();
    related.append(lockup('/watch?v=top'));

    // With autoplay off (or cancelled), the end screen shows videos and no countdown.
    expect(destination(navigate(playerHost, YOUTUBES_PICK))).toBe(YOUTUBES_PICK);
  });
});

it('leaves navigations to other videos alone', () => {
  const { watchPage, related } = mountWatchPage();
  related.append(lockup('/watch?v=top'));

  // Such as a video the creator linked in the video's end screen.
  expect(destination(navigate(watchPage, 'endScreenVideo'))).toBe('endScreenVideo');
});

describe('the autoplay countdown', () => {
  const countdown = () => {
    const overlay = document.querySelector('.ytp-autonav-endscreen-countdown-overlay');
    const text = (selector: string) => overlay?.querySelector(selector)?.textContent;
    return {
      title: text('.ytp-autonav-endscreen-upnext-title'),
      channel: text('.ytp-autonav-endscreen-upnext-author'),
      viewsAndDate: text('.ytp-autonav-view-and-date'),
      channelAndViews: text('.ytp-autonav-author-and-view'),
      duration: text('.ytp-autonav-timestamp'),
      links: Array.from(overlay?.querySelectorAll('a') ?? [], (link) => link.href),
      thumbnail: overlay?.querySelector<HTMLElement>('.ytp-autonav-endscreen-upnext-thumbnail')
        ?.style.backgroundImage,
    };
  };
  const pageLoaded = () => document.dispatchEvent(new Event('yt-navigate-finish'));
  /** Lets the countdown's MutationObserver run. */
  const settle = () => new Promise((resolve) => setTimeout(resolve));

  it('shows the video that will play', () => {
    const { related } = mountWatchPage();
    related.append(lockup('/watch?v=top', 'The top video'));

    pageLoaded();

    expect(countdown()).toEqual({
      title: 'The top video',
      channel: 'The Channel',
      viewsAndDate: '1.7M 2w ago',
      channelAndViews: 'The Channel',
      duration: '16:31',
      links: [`${location.origin}/watch?v=top`, `${location.origin}/watch?v=top`],
      thumbnail: 'url("https://i.ytimg.com/vi/thumbnail.jpg")',
    });
  });

  it('stays on that video when YouTube fills it in again', async () => {
    const { related } = mountWatchPage();
    related.append(lockup('/watch?v=top', 'The top video'));
    pageLoaded();

    const title = document.querySelector('.ytp-autonav-endscreen-upnext-title');
    if (title) title.textContent = "YouTube's pick";
    await settle();

    expect(countdown().title).toBe('The top video');
  });

  it('follows changes to the sidebar when it appears', async () => {
    const { related, showCountdown } = mountWatchPage();
    related.append(lockup('/watch?v=top', 'The top video'));
    pageLoaded();

    related.prepend(lockup('/watch?v=newTop', 'The new top video'));
    showCountdown();
    await settle();

    expect(countdown().title).toBe('The new top video');
  });

  it('is found when the video ends, at the latest', () => {
    const { related } = mountWatchPage();
    related.append(lockup('/watch?v=top', 'The top video'));

    document.body.append(document.createElement('video'));
    document.querySelector('video')?.dispatchEvent(new Event('ended'));

    expect(countdown().title).toBe('The top video');
  });

  it("keeps YouTube's pick in a playlist", () => {
    const { related } = mountWatchPage({ playlist: ['current', 'next'] });
    related.append(lockup('/watch?v=top', 'The top video'));

    pageLoaded();

    expect(countdown().title).toBe("YouTube's pick");
  });

  it('falls back to a thumbnail made from the video ID', () => {
    const { related } = mountWatchPage();
    const entry = lockup('/watch?v=top');
    entry.querySelector('img')?.remove();
    related.append(entry);

    pageLoaded();

    expect(countdown().thumbnail).toBe('url("https://i.ytimg.com/vi/top/mqdefault.jpg")');
  });
});
