import { findSuccessor, isAttached, type MediaCandidate } from './media';
import type { OpenResult, PlayerView } from './messages';
import { playerDetails } from './player-details';
import styles from './floating-player.css?inline';

type ControlsView = Exclude<PlayerView, 'video'>;
type PictureInPictureHost = Window & {
  documentPictureInPicture?: {
    requestWindow(options: { width: number; height: number }): Promise<Window>;
  };
};

export function documentPiP() {
  return (window as PictureInPictureHost).documentPictureInPicture;
}

export interface FloatingPlayer {
  window: Window;
  candidate?: MediaCandidate;
  view: ControlsView;
  setView(view: ControlsView): void;
}

export function mountFloatingPlayer(
  pip: Window,
  initial: MediaCandidate,
  initialView: ControlsView,
  actions: {
    videoBlocked(candidate: MediaCandidate): boolean;
    showVideo(candidate: MediaCandidate, overrideSiteOptOut?: boolean): Promise<OpenResult>;
    onClose(): void;
  },
): FloatingPlayer {
  const doc = pip.document;
  doc.title = 'Detached';
  doc.documentElement.lang = 'en';
  const sheet = new (pip as Window & typeof globalThis).CSSStyleSheet();
  sheet.replaceSync(styles);
  doc.adoptedStyleSheets = [sheet];

  const main = doc.createElement('main');
  const header = doc.createElement('header');
  const artwork = doc.createElement('img');
  artwork.alt = '';
  artwork.hidden = true;
  artwork.referrerPolicy = 'no-referrer';
  const info = doc.createElement('div');
  const title = doc.createElement('h1');
  const nextTitle = doc.createElement('p');
  nextTitle.className = 'next';
  info.append(title, nextTitle);
  header.append(artwork, info);

  const status = doc.createElement('p');
  status.setAttribute('role', 'status');
  const transport = doc.createElement('nav');
  transport.setAttribute('aria-label', 'Playback');
  const footer = doc.createElement('footer');

  function addButton(parent: HTMLElement, label: string) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.textContent = label;
    parent.append(button);
    return button;
  }

  const previous = addButton(transport, 'Previous');
  const play = addButton(transport, 'Play');
  play.className = 'primary';
  const next = addButton(transport, 'Next');
  const viewButton = addButton(footer, 'Compact view');
  const videoButton = addButton(footer, 'Show video');
  const overrideVideo = addButton(footer, 'Open anyway once');
  overrideVideo.hidden = true;

  const seekRow = doc.createElement('div');
  seekRow.className = 'seek-row';
  const seek = doc.createElement('input');
  seek.type = 'range';
  seek.step = '0.1';
  seek.setAttribute('aria-label', 'Playback position');
  const elapsed = doc.createElement('output');
  elapsed.setAttribute('aria-label', 'Elapsed time');
  seekRow.append(seek, elapsed);

  const volumeLabel = doc.createElement('label');
  const volume = doc.createElement('input');
  volume.type = 'range';
  volume.min = '0';
  volume.max = '1';
  volume.step = '0.01';
  volumeLabel.append('Volume', volume);
  footer.append(volumeLabel);
  main.append(header, status, transport, seekRow, footer);
  doc.body.append(main);

  let mediaEvents = new AbortController();
  let discoveryEvents = new AbortController();
  let details: ReturnType<typeof playerDetails> | undefined;
  let failedImage: string | undefined;
  let pendingRefresh: number | undefined;
  let switching = false;
  let sourceDocument = initial.element.ownerDocument;
  let sourceRoot = initial.element.getRootNode();
  const observer = new MutationObserver(scheduleRefresh);
  const player: FloatingPlayer = {
    window: pip,
    view: initialView,
    setView(view) {
      if (player.view === view) return;
      player.view = view;
      renderDetails();
      // Chromium versions that support resizing require activation in the PiP window.
      if (pip.navigator.userActivation?.isActive) {
        const delta = main.scrollHeight - pip.innerHeight;
        if (Math.abs(delta) > 4) {
          try {
            pip.resizeBy(0, delta);
          } catch {
            // The controls can switch views even when the browser keeps the window size.
          }
        }
      }
    },
  };

  function setStatus(message: string) {
    status.textContent = message;
    status.hidden = !message;
  }

  function renderDetails() {
    const text = details?.title ?? 'Media source changed';
    if (title.textContent !== text) title.textContent = text;
    title.title = text;
    const image = details?.artwork !== failedImage ? details?.artwork : undefined;
    const visibleImage = player.view === 'artwork' ? image : undefined;
    artwork.hidden = !visibleImage;
    if (visibleImage && visibleImage !== artwork.getAttribute('src')) artwork.src = visibleImage;
    if (!visibleImage && artwork.hasAttribute('src')) artwork.removeAttribute('src');
    viewButton.textContent = player.view === 'artwork' ? 'Compact view' : 'Artwork view';
    viewButton.hidden = !image;
    nextTitle.hidden = !visibleImage || !details?.upNext;
    nextTitle.textContent = nextTitle.hidden ? '' : `Up next: ${details?.upNext}`;
    const hasPlaylistControls = !!(details?.previousButton || details?.nextButton);
    previous.hidden = next.hidden = !hasPlaylistControls;
    previous.disabled = !details?.previousButton;
    next.disabled = !details?.nextButton;
    videoButton.hidden = player.candidate?.kind !== 'video';
  }

  function updateControls() {
    const candidate = player.candidate;
    const media = candidate?.source === 'html' ? candidate.element : undefined;
    volumeLabel.hidden = candidate?.source === 'soundcloud';
    if (candidate?.source === 'soundcloud') {
      play.disabled = !details?.playButton;
      play.textContent = details?.playing ? 'Pause' : 'Play';
      seekRow.hidden = true;
      return;
    }
    play.disabled = volume.disabled = !media;
    seekRow.hidden = !media?.seekable.length;
    if (!media) return;
    play.textContent = media.paused || media.ended ? 'Play' : 'Pause';
    volume.value = String(media.muted ? 0 : media.volume);
    const range = media.seekable.length - 1;
    if (range >= 0) {
      seek.min = String(media.seekable.start(range));
      seek.max = String(media.seekable.end(range));
      seek.value = String(media.currentTime);
      elapsed.value = elapsedTime(media.currentTime);
    }
  }

  function refreshDetails() {
    details = player.candidate && playerDetails(player.candidate);
    renderDetails();
  }

  function bind(candidate?: MediaCandidate) {
    mediaEvents.abort();
    mediaEvents = new AbortController();
    player.candidate = candidate;
    overrideVideo.hidden = true;
    setStatus(candidate ? '' : 'Select the current media from the Detached toolbar.');
    if (candidate?.source === 'html') {
      for (const name of ['play', 'pause', 'ended', 'timeupdate', 'volumechange', 'durationchange', 'progress', 'emptied']) {
        candidate.element.addEventListener(name, updateControls, { signal: mediaEvents.signal });
      }
      candidate.element.addEventListener('loadedmetadata', refresh, { signal: mediaEvents.signal });
    }
    refreshDetails();
    updateControls();
  }

  function observeSource() {
    observer.disconnect();
    discoveryEvents.abort();
    discoveryEvents = new AbortController();
    for (const root of new Set([document, sourceDocument, sourceRoot])) {
      observer.observe(root, {
        childList: true,
        subtree: true,
        attributeFilter: ['disablepictureinpicture', 'poster', 'selected', 'aria-disabled', 'disabled', 'href', 'src'],
      });
      for (const event of ['loadedmetadata', 'play', 'load', 'yt-navigate-finish', 'yt-page-data-updated']) {
        root.addEventListener(event, scheduleRefresh, { capture: true, signal: discoveryEvents.signal });
      }
    }
    const candidate = player.candidate;
    if (candidate?.source === 'soundcloud') {
      observer.observe(candidate.element, {
        subtree: true,
        childList: true,
        characterData: true,
        attributeFilter: ['class', 'title', 'aria-label', 'aria-pressed', 'aria-disabled', 'disabled', 'hidden', 'src', 'style'],
      });
    }
  }

  function scheduleRefresh() {
    pendingRefresh ??= window.setTimeout(refresh, 100);
  }

  function refresh() {
    window.clearTimeout(pendingRefresh);
    pendingRefresh = undefined;
    const candidate = player.candidate;
    if (candidate && isAttached(candidate.element)) {
      if (actions.videoBlocked(candidate)) pip.close();
      else {
        refreshDetails();
        if (candidate.source === 'soundcloud') updateControls();
      }
      return;
    }
    const replacement = findSuccessor(initial.kind);
    if (replacement && actions.videoBlocked(replacement)) {
      pip.close();
      return;
    }
    if (candidate || replacement) bind(replacement);
    if (replacement) {
      sourceDocument = replacement.element.ownerDocument;
      sourceRoot = replacement.element.getRootNode();
      observeSource();
    }
  }

  artwork.addEventListener('error', () => {
    failedImage = artwork.getAttribute('src') ?? undefined;
    renderDetails();
  });
  viewButton.addEventListener('click', () => player.setView(player.view === 'artwork' ? 'compact' : 'artwork'));
  async function showVideo(overrideSiteOptOut: boolean) {
    if (!player.candidate || switching) return;
    overrideVideo.hidden = true;
    switching = videoButton.disabled = true;
    const candidate = player.candidate;
    try {
      const result = await actions.showVideo(candidate, overrideSiteOptOut);
      if (result.status !== 'opened' && player.candidate === candidate) {
        setStatus(result.message ?? 'Use the Detached button in the source tab to show video.');
        overrideVideo.hidden = result.reason !== 'site-opt-out';
        if (!overrideVideo.hidden) overrideVideo.focus();
      }
    } finally {
      switching = videoButton.disabled = false;
    }
  }
  videoButton.addEventListener('click', () => void showVideo(false));
  overrideVideo.addEventListener('click', () => {
    if (!overrideVideo.hidden) void showVideo(true);
  });

  function skip(direction: 'previousButton' | 'nextButton') {
    const candidate = player.candidate;
    if (candidate && isAttached(candidate.element)) playerDetails(candidate)[direction]?.click();
    refreshDetails();
  }
  previous.addEventListener('click', () => skip('previousButton'));
  next.addEventListener('click', () => skip('nextButton'));

  play.addEventListener('click', async () => {
    const candidate = player.candidate;
    if (!candidate || !isAttached(candidate.element)) return;
    setStatus('');
    if (candidate.source === 'soundcloud') {
      playerDetails(candidate).playButton?.click();
      refresh();
      return;
    }
    const media = candidate.element;
    if (!media.paused && !media.ended) {
      media.pause();
      return;
    }
    try {
      await media.play();
    } catch {
      if (player.candidate?.element === media) setStatus('The site could not resume playback.');
    }
  });
  seek.addEventListener('input', () => {
    if (player.candidate?.source === 'html' && !seekRow.hidden) {
      player.candidate.element.currentTime = seek.valueAsNumber;
    }
  });
  volume.addEventListener('input', () => {
    const candidate = player.candidate;
    if (candidate?.source !== 'html') return;
    const media = candidate.element;
    const level = volume.valueAsNumber;
    media.volume = level;
    media.muted = level === 0;
  });
  pip.addEventListener('pagehide', () => {
    window.clearTimeout(pendingRefresh);
    observer.disconnect();
    discoveryEvents.abort();
    mediaEvents.abort();
    actions.onClose();
  }, { once: true });

  bind(initial);
  observeSource();
  return player;
}

function elapsedTime(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, '0')}`;
}
