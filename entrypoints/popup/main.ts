import { browser } from 'wxt/browser';
import { defaultView, type MediaChoice, type MediaScan, type OpenResult, type PlayerRequest, type PlayerView } from '../../lib/messages';

const status = document.querySelector<HTMLParagraphElement>('#status')!;
const form = document.querySelector<HTMLFormElement>('form')!;
const title = document.querySelector<HTMLParagraphElement>('#title')!;
const upNext = document.querySelector<HTMLParagraphElement>('#next')!;
const picker = document.querySelector<HTMLLabelElement>('#media-picker')!;
const select = document.querySelector<HTMLSelectElement>('#media')!;
const fieldset = form.querySelector<HTMLFieldSetElement>('fieldset')!;
const radios = [...fieldset.querySelectorAll<HTMLInputElement>('input')];
const videoRadio = fieldset.querySelector<HTMLInputElement>('[value="video"]')!;
const submit = form.querySelector<HTMLButtonElement>('button')!;
const refresh = document.querySelector<HTMLButtonElement>('#refresh')!;
const embed = document.querySelector<HTMLButtonElement>('#embed')!;

let tabId: number | undefined;
let embedUrl: string | undefined;
let choices: MediaChoice[] = [];
let lastScan = '';
let busy = false;
let updating = false;

function setStatus(text: string) {
  status.textContent = text;
  status.hidden = !text;
}

function updateSelection(keepView = false) {
  const choice = choices.find(item => item.id === Number(select.value));
  if (!choice) return;
  title.textContent = choice.title;
  upNext.hidden = !choice.upNext;
  upNext.textContent = choice.upNext ? `Up next: ${choice.upNext}` : '';
  videoRadio.disabled = choice.kind !== 'video';
  videoRadio.closest('label')!.hidden = videoRadio.disabled;
  if (!keepView || !radios.some(radio => radio.checked && !radio.disabled)) {
    const view = choice.view ?? defaultView(choice.kind);
    for (const radio of radios) radio.checked = radio.value === view;
  }
  submit.textContent = choice.view ? 'Switch view' : 'Open player';
}

function renderScan(result: MediaScan) {
  const key = JSON.stringify(result);
  if (key === lastScan) return;
  lastScan = key;
  const previous = select.value;
  choices = result.choices;
  embedUrl = result.embedUrl;
  embed.hidden = !embedUrl;
  select.replaceChildren(...choices.map(({ id, title, kind, playing }) =>
    new Option(`${title} · ${kind}${playing ? ' · playing' : ''}`, String(id)),
  ));
  const keepSelection = choices.some(({ id }) => String(id) === previous);
  if (keepSelection) select.value = previous;
  picker.hidden = choices.length < 2;
  form.hidden = !choices.length;
  if (choices.length) {
    if (status.textContent === 'Looking for media…' || !keepSelection) setStatus('');
    updateSelection(keepSelection);
  } else {
    setStatus(embedUrl ? 'This player is embedded from another site.' : 'Start playing a video or audio track, then scan again.');
  }
}

async function readTab(id: number): Promise<MediaScan> {
  const request: PlayerRequest = { detached: 'scan' };
  return browser.tabs.sendMessage(id, request);
}

async function scan() {
  if (busy || updating) return;
  busy = true;
  lastScan = '';
  setStatus('Looking for media…');
  form.hidden = refresh.hidden = embed.hidden = true;
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab?.id === undefined) throw new Error('No active tab');
    tabId = tab.id;
    await browser.scripting.executeScript({ target: { tabId }, files: ['/player.js'] });
    renderScan(await readTab(tabId));
  } catch {
    tabId = undefined;
    setStatus('Detached cannot read this tab. Try opening the media on a regular website.');
  } finally {
    busy = false;
    refresh.hidden = false;
  }
}

const poll = window.setInterval(async () => {
  if (busy || updating || form.hidden || tabId === undefined) return;
  updating = true;
  try {
    const result = await readTab(tabId);
    if (!busy) renderScan(result);
  } catch {
    // The source may be navigating. The user can scan again after it loads.
  } finally {
    updating = false;
  }
}, 1500);

window.addEventListener('pagehide', () => window.clearInterval(poll), { once: true });
select.addEventListener('change', () => updateSelection());
refresh.addEventListener('click', () => void scan());
embed.addEventListener('click', async () => {
  if (!embedUrl || tabId === undefined) return;
  try {
    await browser.tabs.create({ url: embedUrl, openerTabId: tabId });
    window.close();
  } catch {
    setStatus('The embedded player could not be opened.');
  }
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const view = radios.find(radio => radio.checked && !radio.disabled)?.value as PlayerView | undefined;
  if (busy || tabId === undefined || !select.value || !view) return;
  busy = true;
  submit.disabled = refresh.disabled = select.disabled = fieldset.disabled = true;
  try {
    const request: PlayerRequest = { detached: 'open', mediaId: Number(select.value), view };
    const result: OpenResult = await browser.tabs.sendMessage(tabId, request);
    if (result.status === 'error') {
      setStatus(result.message ?? 'Could not open the mini player.');
      submit.textContent = 'Try again';
    } else window.close();
  } catch {
    setStatus('The source page changed. Scan again to refresh the list.');
  } finally {
    busy = false;
    submit.disabled = refresh.disabled = select.disabled = fieldset.disabled = false;
  }
});

void scan();
