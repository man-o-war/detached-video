import { browser } from 'wxt/browser';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { documentPiP, mountFloatingPlayer, type FloatingPlayer } from '../lib/floating-player';
import { findSuccessor, isAttached, isCandidatePlayable, scanPage, type MediaCandidate } from '../lib/media';
import { defaultView, type MediaScan, type OpenResult, type PlayerRequest, type PlayerView } from '../lib/messages';
import { showPageButton } from '../lib/page-button';
import { playerDetails } from '../lib/player-details';

function videoInPiP(element: HTMLElement) {
  const root = element.getRootNode() as Document | ShadowRoot;
  return element.tagName === 'VIDEO' && root.pictureInPictureElement === element;
}

function blockedMessage({ element }: MediaCandidate) {
  if (element.tagName === 'VIDEO' &&
      ((element as HTMLVideoElement).disablePictureInPicture || element.hasAttribute('disablepictureinpicture'))) {
    return 'This site disabled Picture-in-Picture for the selected video.';
  }
  if (element.ownerDocument.pictureInPictureEnabled === false || document.pictureInPictureEnabled === false) {
    return 'Chrome or this page’s permissions policy disables Picture-in-Picture.';
  }
}

export default defineUnlistedScript(() => {
  // Toolbar scans can inject this file repeatedly into the same isolated world.
  const page = globalThis as typeof globalThis & { detachedPlayerInstalled?: boolean };
  if (page.detachedPlayerInstalled) return;
  page.detachedPlayerInstalled = true;

  const mediaIds = new WeakMap<HTMLElement, number>();
  let nextId = 1;
  let choices = new Map<number, MediaCandidate>();
  let removeButton: (() => void) | undefined;
  let controls: FloatingPlayer | undefined;
  let opening = false;

  function scan(): MediaScan {
    const { media, embedUrl } = scanPage();
    choices = new Map(media.map(candidate => {
      const id = mediaIds.get(candidate.element) ?? nextId++;
      mediaIds.set(candidate.element, id);
      return [id, candidate];
    }));
    return {
      choices: Array.from(choices, ([id, candidate]) => {
        const { kind, playing, element } = candidate;
        const { title, upNext } = playerDetails(candidate);
        const view = controls?.candidate?.element === element
          ? controls.view
          : videoInPiP(element) ? 'video' : undefined;
        return { id, kind, title, playing, view, upNext };
      }),
      embedUrl,
    };
  }

  function prompt(getCandidate: () => MediaCandidate | undefined, view: PlayerView) {
    removeButton?.();
    removeButton = showPageButton(async () => {
      const candidate = getCandidate();
      if (!candidate) return 'Select the current media from the Detached toolbar.';
      const result = await open(candidate, view, true);
      return result.status === 'opened' ? undefined : result.message;
    });
  }

  function watchVideo(video: HTMLVideoElement, sourceDocument: Document) {
    const observer = new MutationObserver(checkSource);
    observer.observe(document, { childList: true, subtree: true });
    if (sourceDocument !== document) observer.observe(sourceDocument, { childList: true, subtree: true });
    const root = video.getRootNode();
    if (root !== sourceDocument) observer.observe(root, { childList: true, subtree: true });

    function stop() {
      observer.disconnect();
      video.removeEventListener('leavepictureinpicture', onLeave);
    }

    function checkSource() {
      if (isAttached(video)) return;
      stop();
      prompt(() => findSuccessor('video'), 'video');
    }

    function onLeave() {
      checkSource();
      stop();
    }
    video.addEventListener('leavepictureinpicture', onLeave, { once: true });
  }

  async function open(candidate: MediaCandidate, view: PlayerView, fromPage = false): Promise<OpenResult> {
    const { element, kind } = candidate;
    const doc = element.ownerDocument;

    if (!isCandidatePlayable(candidate)) return { status: 'error', message: 'This media changed. Scan again to select it.' };
    if (opening) return { status: 'error', message: 'A mini player is already opening.' };
    const blocked = blockedMessage(candidate);
    if (blocked) return { status: 'error', message: blocked };

    opening = true;
    try {
      if (view === 'video') {
        const video = candidate.source === 'html' && kind === 'video'
          ? candidate.element as HTMLVideoElement
          : undefined;
        if (!video?.requestPictureInPicture) {
          return { status: 'error', message: 'Native Picture-in-Picture is unavailable for this media.' };
        }
        if (!videoInPiP(video)) {
          await video.requestPictureInPicture();
          controls?.window.close();
          watchVideo(video, doc);
        }
      } else if (controls?.candidate?.element === element && !controls.window.closed) {
        controls.setView(view);
      } else {
        const host = documentPiP();
        if (!host) {
          return { status: 'error', message: 'This page or browser does not support floating controls.' };
        }
        const hasArtwork = view === 'artwork' && !!playerDetails(candidate).artwork;
        const pip = await host.requestWindow({ width: 360, height: hasArtwork ? 222 : 168 });
        try {
          controls = mountFloatingPlayer(pip, candidate, view, {
            videoBlocked: media => !!blockedMessage(media),
            showVideo: media => open(media, 'video'),
            onClose: () => {
              if (controls?.window === pip) controls = undefined;
            },
          });
        } catch (error) {
          pip.close();
          throw error;
        }
      }
      removeButton?.();
      removeButton = undefined;
      return { status: 'opened' };
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (!fromPage && name === 'NotAllowedError') {
        prompt(() => candidate, view);
        return { status: 'gesture' };
      }
      if (name === 'SecurityError') {
        return { status: 'error', message: 'This page’s permissions policy blocks Picture-in-Picture.' };
      }
      return { status: 'error', message: 'The browser or site could not open Picture-in-Picture for this media.' };
    } finally {
      opening = false;
    }
  }

  browser.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    if (sender.id !== browser.runtime.id || !message || typeof message !== 'object') return;
    const request = message as PlayerRequest;
    if (request.detached === 'scan') {
      respond(scan());
    } else if (request.detached === 'open') {
      const candidate = choices.get(request.mediaId);
      if (!candidate) {
        respond({ status: 'error', message: 'Scan again to select the current media.' } satisfies OpenResult);
        return;
      }
      void open(candidate, request.view ?? defaultView(candidate.kind)).then(respond, () => {
        respond({ status: 'error', message: 'Could not open the mini player.' });
      });
      return true;
    }
  });
});
