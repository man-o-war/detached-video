# Roadmap

## Chromium

The extension uses native Picture-in-Picture for Video and Document
Picture-in-Picture for Artwork and Compact. It works with HTML media in the
source tab, including accessible same-origin frames and open shadow roots.
The floating window closes when the source document goes away.

- Verify both player types over a separate desktop app with the source window
  minimized. Start on macOS and extend coverage to Windows and Linux.
- Verify Chrome, Edge, and Brave, recording versions and results.
- Verify the YouTube playlist and SoundCloud player bar adapters in a real
  browser. Exercise Dailymotion to find gaps in generic media handling.
- Add release assets and store listings after confirming the support matrix.

Native video playback on YouTube worked in a manual check of the first release.
The v0.2 viewing modes, playlist adapter, and desktop layering still need a
live browser check.

## Firefox

Build a separate Firefox target after the Chromium trial. Reuse media discovery
and controls, and verify Firefox's picture-in-picture options before advertising
feature parity.

References: [Video Picture-in-Picture](https://developer.mozilla.org/en-US/docs/Web/API/Picture-in-Picture_API)
and [Document Picture-in-Picture](https://developer.chrome.com/docs/web-platform/document-picture-in-picture).
