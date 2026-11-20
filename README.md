# Detached

An open-source mini player for desktop Chromium browsers. Float media above other
windows in **Video**, **Artwork**, or **Compact** view.

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
3. Start a video or audio track, click **Detached** in the toolbar, choose a view,
   and select **Open player**. If a button appears in the page, click it to open the
   player with a direct browser gesture.
4. Keep the source tab open. Minimize its window or switch to another app to
   continue using the mini player.

Chrome supplies the controls in Video view. Artwork and Compact provide
play/pause, seeking when available, and volume. Artwork displays the current
cover when one is available, while Compact hides all imagery. Use the toolbar
to switch out of Video view, or **Show video** from the floating controls to
switch back. The site continues streaming in every view, subject to its browser
and playback policies.

When a video asks Chrome to disable Picture-in-Picture, Detached offers
**Open anyway once** after you try to open it. That choice applies to the
selected video for the current floating session.

On desktop YouTube watch pages with an active playlist, the toolbar shows
**Up next** when YouTube exposes the next track. The floating controls can
use YouTube's Previous and Next actions and follow automatic track changes.

For SoundCloud, start a track on the site before opening Detached. Artwork and
Compact use SoundCloud's player bar for play/pause and available track skips
when the page doesn't expose a playable audio element.

If an embedded player comes from another origin, Detached can offer to open it
directly in a tab when it identifies a single player URL.

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
