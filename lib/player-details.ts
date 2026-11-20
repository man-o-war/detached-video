import { mediaTitle, type MediaCandidate } from './media';
import { readSoundCloudTrack } from './soundcloud';
import { readYouTubePlaylist } from './youtube';

function artworkUrl(source: string | undefined, doc: Document): string | undefined {
  if (!source) return;
  try {
    const url = new URL(source, doc.baseURI);
    if (url.protocol === 'https:' || url.protocol === 'http:' ||
        (url.protocol === 'blob:' && url.origin === doc.location?.origin)) return url.href;
  } catch {
    // A site can supply an invalid artwork URL.
  }
}

interface PlayerDetails {
  title: string;
  artwork?: string;
  upNext?: string;
  previousButton?: HTMLElement;
  nextButton?: HTMLElement;
  playButton?: HTMLElement;
  playing?: boolean;
}

export function playerDetails(candidate: MediaCandidate): PlayerDetails {
  const { element, kind } = candidate;
  if (candidate.source === 'soundcloud') {
    const track = readSoundCloudTrack(candidate.element);
    return track
      ? { ...track, artwork: artworkUrl(track.artwork, element.ownerDocument) }
      : { title: 'SoundCloud' };
  }
  const doc = element.ownerDocument;
  const playlist = readYouTubePlaylist(candidate.element);
  const metadata = doc.defaultView?.navigator.mediaSession?.metadata;
  // During a YouTube navigation, the poster and Media Session can still describe the old track.
  const metadataArtwork = () => metadata?.artwork.map(image => artworkUrl(image.src, doc)).findLast(Boolean);
  const artwork = playlist
    ? artworkUrl(playlist.current?.artwork, doc) ??
      (playlist.current?.title === metadata?.title ? metadataArtwork() : undefined)
    : metadataArtwork() ?? artworkUrl(element.getAttribute('poster') ?? undefined, doc);
  return {
    title: playlist?.current?.title || mediaTitle(candidate.element, kind),
    artwork,
    upNext: playlist?.next?.title,
    previousButton: playlist?.previousButton,
    nextButton: playlist?.nextButton,
  };
}
