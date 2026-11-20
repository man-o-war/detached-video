import type { MediaKind } from './messages';
import { findSoundCloudPlayer, readSoundCloudTrack } from './soundcloud';

interface HtmlMediaCandidate {
  source: 'html';
  element: HTMLMediaElement;
  kind: MediaKind;
  title: string;
  playing: boolean;
}

interface SoundCloudCandidate {
  source: 'soundcloud';
  element: HTMLElement;
  kind: 'audio';
  title: string;
  playing: boolean;
}

export type MediaCandidate = HtmlMediaCandidate | SoundCloudCandidate;

export function isAttached(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  let doc = element.ownerDocument;
  while (doc !== document) {
    const frame = doc.defaultView?.frameElement;
    if (!frame?.isConnected || (frame as HTMLIFrameElement).contentDocument !== doc) return false;
    doc = frame.ownerDocument;
  }
  return true;
}

function isPlayable(element: HTMLMediaElement): boolean {
  return isAttached(element) && !element.error && element.readyState >= element.HAVE_METADATA;
}

export function isCandidatePlayable(candidate: MediaCandidate): boolean {
  return candidate.source === 'html'
    ? isPlayable(candidate.element)
    : isAttached(candidate.element) && !!readSoundCloudTrack(candidate.element);
}

export function isPlaying(element: HTMLMediaElement): boolean {
  return !element.paused && !element.ended;
}

export function mediaTitle(element: HTMLMediaElement, kind: MediaKind): string {
  return element.getAttribute('aria-label')?.trim() ||
    element.title.trim() ||
    element.ownerDocument.defaultView?.navigator.mediaSession?.metadata?.title?.trim() ||
    element.ownerDocument.title.trim() ||
    document.title.trim() ||
    (kind === 'video' ? 'Video' : 'Audio');
}

export function scanPage(): { media: MediaCandidate[]; embedUrl?: string } {
  const media: MediaCandidate[] = [];
  const embeds = new Set<string>();

  function scan(root: Document | ShadowRoot) {
    for (const node of root.querySelectorAll('*')) {
      if (node.tagName === 'VIDEO' || node.tagName === 'AUDIO') {
        const element = node as HTMLMediaElement;
        if (isPlayable(element)) {
          const kind = element.tagName === 'VIDEO' && (element as HTMLVideoElement).videoWidth > 0
            ? 'video'
            : 'audio';
          media.push({ source: 'html', element, kind, title: mediaTitle(element, kind), playing: isPlaying(element) });
        }
      } else if (node.tagName === 'IFRAME') {
        const frame = node as HTMLIFrameElement;
        if (frame.contentDocument) {
          scan(frame.contentDocument);
        } else if (
          frame.clientWidth >= 160 && frame.clientHeight >= 80 &&
          (/autoplay|picture-in-picture/.test(frame.allow) || /\/embed(?:\/|\?|$)/.test(frame.src))
        ) {
          try {
            const url = new URL(frame.src);
            if (url.protocol === 'https:' || url.protocol === 'http:') embeds.add(url.href);
          } catch {
            // Some frames do not have a navigable source URL.
          }
        }
      }
      if (node.shadowRoot) scan(node.shadowRoot);
    }
  }

  scan(document);
  if (!media.some(candidate => candidate.kind === 'audio')) {
    const player = findSoundCloudPlayer(document);
    const track = player && readSoundCloudTrack(player);
    if (track) {
      media.unshift({ source: 'soundcloud', element: player, kind: 'audio', title: track.title, playing: track.playing });
    }
  }
  media.sort((a, b) => Number(b.playing) - Number(a.playing));
  return { media, embedUrl: embeds.size === 1 ? [...embeds][0] : undefined };
}

export function findSuccessor(kind: MediaKind): MediaCandidate | undefined {
  const matches = scanPage().media.filter(candidate => candidate.kind === kind);
  const playing = matches.filter(candidate => candidate.playing);
  const candidates = playing.length ? playing : matches;
  return candidates.length === 1 ? candidates[0] : undefined;
}
