export function showPageButton(onOpen: () => Promise<string | undefined>): () => void {
  const host = document.createElement('div');
  host.style.cssText = 'all: initial; position: fixed; inset: auto 16px 16px auto; z-index: 2147483647;';
  const shadow = host.attachShadow({ mode: 'closed' });
  const bar = document.createElement('div');
  bar.style.cssText = 'font: 14px system-ui; padding: 10px; max-width: 280px; border-radius: 8px; background: #1b2230; color: white; box-shadow: 0 2px 12px #0008;';
  const open = document.createElement('button');
  open.textContent = 'Open Detached mini player';
  const dismiss = document.createElement('button');
  dismiss.textContent = 'Dismiss';
  dismiss.style.marginLeft = '8px';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.style.margin = '8px 0 0';
  status.hidden = true;

  const remove = () => host.remove();
  dismiss.addEventListener('click', remove);
  open.addEventListener('click', async event => {
    if (!event.isTrusted) return;
    open.disabled = true;
    const error = await onOpen();
    if (!error) {
      remove();
      return;
    }
    status.textContent = error;
    status.hidden = false;
    open.disabled = false;
  });
  bar.append(open, dismiss, status);
  shadow.append(bar);
  document.documentElement.append(host);
  open.focus({ preventScroll: true });
  return remove;
}
