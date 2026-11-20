import { browser } from 'wxt/browser';
import type { MediaScan, OpenResult, PlayerRequest } from '../../lib/messages';

const status = document.querySelector<HTMLParagraphElement>('#status')!;
const form = document.querySelector<HTMLFormElement>('form')!;
const select = document.querySelector<HTMLSelectElement>('#media')!;
const submit = form.querySelector<HTMLButtonElement>('button')!;
const refresh = document.querySelector<HTMLButtonElement>('#refresh')!;
const embed = document.querySelector<HTMLButtonElement>('#embed')!;

let tabId: number | undefined;
let embedUrl: string | undefined;

async function scan() {
  status.textContent = 'Looking for media…';
  form.hidden = refresh.hidden = embed.hidden = true;
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) throw new Error('No active tab');
    tabId = tab.id;
    await browser.scripting.executeScript({ target: { tabId }, files: ['/player.js'] });
    const request: PlayerRequest = { detached: 'scan' };
    const result: MediaScan = await browser.tabs.sendMessage(tabId, request);
    embedUrl = result.embedUrl;
    embed.hidden = !embedUrl;
    status.textContent = result.choices.length
      ? ''
      : embedUrl
        ? 'This player is embedded from another site.'
        : 'Start playing a video or audio track, then scan again.';
    select.replaceChildren(...result.choices.map(({ id, title, kind, playing }) =>
      new Option(`${title} · ${kind}${playing ? ' · playing' : ''}`, String(id)),
    ));
    form.hidden = !result.choices.length;
  } catch {
    status.textContent = 'Detached cannot read this tab. Try opening the media on a regular website.';
  } finally {
    refresh.hidden = false;
  }
}

refresh.addEventListener('click', () => void scan());
embed.addEventListener('click', async () => {
  if (!embedUrl || tabId === undefined) return;
  try {
    await browser.tabs.create({ url: embedUrl, openerTabId: tabId });
    window.close();
  } catch {
    status.textContent = 'The embedded player could not be opened.';
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (tabId === undefined || !select.value) return;
  submit.disabled = refresh.disabled = select.disabled = true;
  try {
    const request: PlayerRequest = { detached: 'open', mediaId: Number(select.value) };
    const result: OpenResult = await browser.tabs.sendMessage(tabId, request);
    if (result.status === 'opened') window.close();
    if (result.status === 'gesture') {
      // Reveal the button in the source tab so it can receive a direct gesture.
      window.close();
    }
    if (result.status === 'error') status.textContent = result.message ?? 'Could not open the mini player.';
  } catch {
    status.textContent = 'The source page changed. Scan again to refresh the list.';
  } finally {
    submit.disabled = refresh.disabled = select.disabled = false;
  }
});

void scan();
