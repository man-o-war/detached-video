import { findSuccessor, isAttached, mediaTitle, type MediaCandidate } from './media';

type PictureInPictureHost = Window & {
  documentPictureInPicture?: {
    requestWindow(options: { width: number; height: number }): Promise<Window>;
  };
};

export function audioPiP() {
  return (window as PictureInPictureHost).documentPictureInPicture;
}

export function mountAudioPlayer(pip: Window, initial: MediaCandidate, onClose: () => void) {
  const doc = pip.document;
  doc.title = 'Detached';
  doc.documentElement.lang = 'en';

  const styles = new (pip as Window & typeof globalThis).CSSStyleSheet();
  styles.replaceSync(`
    :root { color-scheme: light dark; font: 14px/1.4 system-ui, sans-serif; }
    body { margin: 0; padding: 14px; background: Canvas; color: CanvasText; }
    h1 { margin: 0 0 8px; font-size: 16px; overflow-wrap: anywhere; }
    p { margin: 0 0 8px; }
    label { display: flex; align-items: center; gap: 8px; margin: 8px 0; }
    input { flex: 1; min-width: 0; accent-color: AccentColor; }
    button { font: inherit; cursor: pointer; }
  `);
  doc.adoptedStyleSheets = [styles];

  const main = doc.createElement('main');
  const title = doc.createElement('h1');
  const status = doc.createElement('p');
  status.setAttribute('role', 'status');
  const toggle = doc.createElement('button');
  toggle.type = 'button';
  toggle.textContent = 'Play';
  main.append(title, status, toggle);

  function addSlider(name: string, step: string) {
    const label = doc.createElement('label');
    const input = doc.createElement('input');
    input.type = 'range';
    input.step = step;
    label.append(name, input);
    main.append(label);
    return input;
  }
  const position = addSlider('Position', '0.1');
  const volume = addSlider('Volume', '0.01');
  volume.min = '0';
  volume.max = '1';
  doc.body.append(main);

  let source: HTMLMediaElement | undefined;
  let mediaEvents = new AbortController();

  function setStatus(message: string) {
    status.textContent = message;
    status.hidden = !message;
  }

  function update() {
    const media = source;
    toggle.disabled = volume.disabled = !media;
    position.disabled = !media?.seekable.length;
    if (!media) return;

    const currentTitle = mediaTitle(media, 'audio');
    if (title.textContent !== currentTitle) title.textContent = currentTitle;
    toggle.textContent = media.paused || media.ended ? 'Play' : 'Pause';
    volume.value = String(media.muted ? 0 : media.volume);
    if (media.seekable.length) {
      const range = media.seekable.length - 1;
      position.min = String(media.seekable.start(range));
      position.max = String(media.seekable.end(range));
      position.value = String(media.currentTime);
    }
  }

  function bind(candidate?: MediaCandidate) {
    mediaEvents.abort();
    mediaEvents = new AbortController();
    source = candidate?.element;
    title.textContent = candidate?.title ?? 'Audio source changed';
    setStatus(candidate ? '' : 'Select a track again from the Detached toolbar.');
    if (source) {
      for (const name of ['play', 'pause', 'ended', 'timeupdate', 'volumechange', 'loadedmetadata', 'durationchange', 'progress', 'emptied']) {
        source.addEventListener(name, update, { signal: mediaEvents.signal });
      }
    }
    update();
  }

  let sourceDocument = initial.element.ownerDocument;
  let sourceRoot = initial.element.getRootNode();
  const observer = new MutationObserver(reconnect);
  let discoveryEvents = new AbortController();

  function observeSource() {
    observer.disconnect();
    discoveryEvents.abort();
    discoveryEvents = new AbortController();
    for (const root of new Set([document, sourceDocument, sourceRoot])) {
      observer.observe(root, { childList: true, subtree: true });
      // A replacement can load its source after its DOM insertion.
      for (const event of ['loadedmetadata', 'play', 'load']) {
        root.addEventListener(event, reconnect, { capture: true, signal: discoveryEvents.signal });
      }
    }
  }

  function reconnect() {
    if (source && isAttached(source)) return;
    const candidate = findSuccessor('audio');
    if (source || candidate) bind(candidate);
    if (candidate) {
      sourceDocument = candidate.element.ownerDocument;
      sourceRoot = candidate.element.getRootNode();
      observeSource();
    }
  }

  bind(initial);
  observeSource();

  toggle.addEventListener('click', async () => {
    const media = source;
    if (!media) return;
    setStatus('');
    if (!media.paused && !media.ended) {
      media.pause();
      return;
    }
    try {
      await media.play();
    } catch {
      if (source === media) setStatus('The site could not resume playback.');
    }
  });
  position.addEventListener('input', () => {
    if (source && !position.disabled) source.currentTime = position.valueAsNumber;
  });
  volume.addEventListener('input', () => {
    if (!source) return;
    source.volume = volume.valueAsNumber;
    source.muted = volume.valueAsNumber === 0;
  });
  pip.addEventListener('pagehide', () => {
    observer.disconnect();
    discoveryEvents.abort();
    mediaEvents.abort();
    onClose();
  }, { once: true });
}
