# Roadmap

## Chromium

The extension uses native video Picture-in-Picture and Document
Picture-in-Picture for audio controls. Both work with media exposed as HTML
elements in the source tab, including accessible same-origin frames and open
shadow roots. The floating audio window closes when the source document goes
away. Desktop pinning and minimize behavior depend on the browser and OS.

- Verify both player types over a separate desktop app with the source window
  minimized. Start on macOS and extend coverage to Windows and Linux.
- Verify Chrome, Edge, and Brave, recording versions and results.
- Exercise YouTube, Dailymotion, and SoundCloud with the generic
  implementation. Track embedded frames, track transitions, live streams, and
  sites that expose no HTML media. Add adapters for reproduced gaps.
- Add release assets and store listings after confirming the support matrix.

Live browser playback, desktop layering, and named-site compatibility have yet
to be verified.

## Firefox

Build a separate Firefox target after the Chromium trial. Reuse media discovery
and controls, and verify Firefox's picture-in-picture options before advertising
feature parity.

References: [Video Picture-in-Picture](https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API)
and [Document Picture-in-Picture](https://developer.chrome.com/docs/web-platform/document-picture-in-picture).
