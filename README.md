# Detached

An open-source mini player for desktop Chromium browsers. Float a video above
other windows, or open a compact set of controls for audio playing in a tab.

Detached is in development. Chrome is the first target, with Edge and Brave
compatibility testing next. See the [roadmap](docs/ROADMAP.md) for Firefox plans
and the current verification status.

## Build and load

Use Node.js 22.12+ or a newer supported LTS release and npm.

```sh
npm ci
npm run typecheck
npm run build
```

1. In Chrome, open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select `.output/chrome-mv3/`.
3. Start a video or audio track, click **Detached** in the toolbar, and choose
   **Open mini player**. If a button appears in the page, click it to open the
   player with a direct browser gesture.
4. Keep the source tab open. Minimize its window or switch to another app to
   continue using the mini player.

Chrome supplies the video controls and the return-to-tab control. The audio
window has play/pause, seeking when available, and volume. Playback stays with
the original site, so site and browser policies still apply. If an embedded
player comes from another origin, Detached can offer to open it directly in
a tab when it identifies a single player URL.

Run `npm run zip` to package the Chromium extension in `.output/`.

## Permissions

Detached reads the current page only after you invoke it. Chrome's
`activeTab` permission grants temporary access to that tab, and `scripting`
lets Detached look for HTML media and open the mini player there. The
extension collects no data and requests no persistent access to sites.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the playback checks.

## License

Copyright 2026 Detached contributors.

Licensed under the [Apache License, Version 2.0](LICENSE). SPDX: `Apache-2.0`.
