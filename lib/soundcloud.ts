const playerSelector = '.playControls';
const playSelector = 'button.playControls__play, button.playControl';

function availableButton(player: HTMLElement, selector: string): HTMLButtonElement | undefined {
  const button = player.querySelector<HTMLButtonElement>(selector);
  if (button && !button.disabled && !button.hidden && button.getAttribute('aria-disabled') !== 'true') return button;
}

export function findSoundCloudPlayer(doc: Document): HTMLElement | null {
  const host = doc.location?.hostname;
  return host === 'soundcloud.com' || host === 'www.soundcloud.com'
    ? doc.querySelector<HTMLElement>(playerSelector)
    : null;
}

export function readSoundCloudTrack(player: HTMLElement) {
  const badge = player.querySelector('.playbackSoundBadge');
  const link = badge?.querySelector('.playbackSoundBadge__titleLink');
  const playButton = availableButton(player, playSelector);
  const metadata = player.ownerDocument.defaultView?.navigator.mediaSession?.metadata;
  const title = link?.getAttribute('title')?.trim() || link?.textContent?.trim() || metadata?.title?.trim();
  if (!playButton || !title) return;

  const avatar = badge?.querySelector<HTMLElement>('.playbackSoundBadge__avatar');
  const image = avatar?.querySelector('img');
  const styled = avatar?.querySelector<HTMLElement>('[style*="background-image"]') ?? avatar;
  const background = styled?.style.backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];
  const playing = playButton.matches('.playing, .m-playing, [aria-pressed="true"]') ||
    /^pause\b/i.test(playButton.getAttribute('aria-label') ?? playButton.title);

  return {
    title,
    artwork: image?.currentSrc || image?.src || background ||
      (metadata?.title?.trim() === title ? metadata.artwork.at(-1)?.src : undefined),
    playing,
    playButton,
    previousButton: availableButton(player, 'button.playControls__prev, button.skipControl__previous'),
    nextButton: availableButton(player, 'button.playControls__next, button.skipControl__next'),
  };
}
