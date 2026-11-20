interface PlaylistItem {
  title?: string;
  artwork?: string;
}

export interface YouTubePlaylist {
  current?: PlaylistItem;
  next?: PlaylistItem;
  previousButton?: HTMLElement;
  nextButton?: HTMLElement;
}

function watchUrl(link: HTMLAnchorElement | null): URL | undefined {
  if (!link?.hasAttribute('href')) return;
  try {
    const url = new URL(link.href, link.ownerDocument.URL);
    if (url.origin === link.ownerDocument.location?.origin && url.pathname === '/watch') return url;
  } catch {
    // Ignore an invalid destination during a player update.
  }
}

function itemDetails(row: Element): PlaylistItem {
  const title = row.querySelector('#video-title');
  return {
    title: title?.getAttribute('title')?.trim() || title?.textContent?.trim(),
    artwork: row.querySelector('img')?.currentSrc || row.querySelector('img')?.src,
  };
}

function findRow(rows: Element[], target: URL, selected = false): Element | undefined {
  const videoId = target.searchParams.get('v');
  const index = target.searchParams.get('index');
  const matches = rows.filter(row => {
    const url = watchUrl(row.querySelector<HTMLAnchorElement>('a#wc-endpoint[href], a[href*="watch?"]'));
    if (!url || url.searchParams.get('v') !== videoId ||
        url.searchParams.get('list') !== target.searchParams.get('list')) return false;
    const rowIndex = url.searchParams.get('index');
    return !index || !rowIndex || rowIndex === index;
  });
  return (selected ? matches.find(row => row.hasAttribute('selected')) : undefined) ??
    (matches.length === 1 ? matches[0] : undefined);
}

function availableButton(player: Element, selector: string, list: string): HTMLElement | undefined {
  const button = player.querySelector<HTMLElement>(selector);
  if (!button || button.hidden || button.style.display === 'none' ||
      button.matches('[aria-disabled="true"], [disabled]')) return;
  const target = button.tagName === 'A' ? watchUrl(button as HTMLAnchorElement) : undefined;
  if (!target || target.searchParams.get('list') === list) return button;
}

export function readYouTubePlaylist(element: HTMLMediaElement): YouTubePlaylist | undefined {
  const doc = element.ownerDocument;
  const page = new URL(doc.URL);
  const list = page.searchParams.get('list');
  if (page.hostname !== 'www.youtube.com' || page.pathname !== '/watch' ||
      !list || !page.searchParams.get('v')) return;
  const player = element.closest('.html5-video-player');
  if (!player || !element.classList.contains('html5-main-video')) return;

  const previousButton = availableButton(player, '.ytp-prev-button', list);
  const nextButton = availableButton(player, '.ytp-next-button', list);
  const rows = Array.from(doc.querySelectorAll('ytd-playlist-panel-renderer ytd-playlist-panel-video-renderer'));
  const currentRow = findRow(rows, page, true);
  // The player's own Next link reflects shuffle and repeat when YouTube exposes a target.
  const nextUrl = nextButton?.tagName === 'A' ? watchUrl(nextButton as HTMLAnchorElement) : undefined;
  const nextRow = nextUrl && findRow(rows, nextUrl);

  return {
    current: currentRow && itemDetails(currentRow),
    next: nextRow && itemDetails(nextRow),
    previousButton,
    nextButton,
  };
}
