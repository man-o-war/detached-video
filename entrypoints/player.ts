import { browser } from 'wxt/browser';
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { audioPiP, mountAudioPlayer } from '../lib/audio-player';
import { findSuccessor, isAttached, isPlayable, scanPage, type MediaCandidate } from '../lib/media';
import type { MediaScan, OpenResult, PlayerRequest } from '../lib/messages';
import { showPageButton } from '../lib/page-button';

export default defineUnlistedScript(() => {
  // Toolbar scans can inject this file repeatedly into the same isolated world.
  const page = globalThis as typeof globalThis & { detachedPlayerInstalled?: boolean };
  if (page.detachedPlayerInstalled) return;
  page.detachedPlayerInstalled = true;

  const mediaIds = new WeakMap<HTMLMediaElement, number>();
  let nextId = 1;
  let choices = new Map<number, MediaCandidate>();
  let removeButton: (() => void) | undefined;
  let currentAudio: Window | undefined;
  let opening = false;

  function scan(): MediaScan {
    const { media, embedUrl } = scanPage();
    choices = new Map(media.map(candidate => {
      const id = mediaIds.get(candidate.element) ?? nextId++;
      mediaIds.set(candidate.element, id);
      return [id, candidate];
    }));
    return {
      choices: Array.from(choices, ([id, { kind, title, playing }]) => ({ id, kind, title, playing })),
      embedUrl,
    };
  }

  function prompt(getCandidate: () => MediaCandidate | undefined) {
    removeButton?.();
    removeButton = showPageButton(async () => {
      const candidate = getCandidate();
      if (!candidate) return 'Select the current video from the Detached toolbar.';
      const result = await open(candidate, true);
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
      prompt(() => findSuccessor('video'));
    }

    function onLeave() {
      checkSource();
      stop();
    }
    video.addEventListener('leavepictureinpicture', onLeave, { once: true });
  }

  async function open(candidate: MediaCandidate, fromPage = false): Promise<OpenResult> {
    const { element, kind } = candidate;
    const doc = element.ownerDocument;
    const host = audioPiP();
    const video = kind === 'video' ? element as HTMLVideoElement : undefined;

    if (!isPlayable(element)) return { status: 'error', message: 'This media changed. Scan again to select it.' };
    if (opening) return { status: 'error', message: 'A mini player is already opening.' };
    if (video && (!doc.pictureInPictureEnabled || !video.requestPictureInPicture)) {
      return { status: 'error', message: 'Chrome or this page’s permissions policy disables Picture-in-Picture.' };
    }
    if (video?.disablePictureInPicture || video?.hasAttribute('disablepictureinpicture')) {
      return { status: 'error', message: 'This site disabled Picture-in-Picture for the selected video.' };
    }
    if (!video && !host) {
      return { status: 'error', message: 'This page or browser does not support a floating audio window.' };
    }
    if (video && doc.pictureInPictureElement === video) {
      removeButton?.();
      return { status: 'opened' };
    }

    opening = true;
    try {
      if (video) {
        await video.requestPictureInPicture();
        currentAudio?.close();
        watchVideo(video, doc);
      } else if (host) {
        const pip = await host.requestWindow({ width: 360, height: 180 });
        try {
          mountAudioPlayer(pip, candidate, () => {
            if (currentAudio === pip) currentAudio = undefined;
          });
          currentAudio = pip;
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
        prompt(() => candidate);
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
      void open(candidate).then(respond, () => respond({ status: 'error', message: 'Could not open the mini player.' }));
      return true;
    }
  });
});
