# Contributing

Run `npm run typecheck` and `npm run build`, then load or reload the unpacked
extension with the [README instructions](README.md).

## Browser smoke test

Use a page with a normal HTML video, then a page with a normal HTML audio
element. Include at least one page with multiple media elements.

1. Start playback and invoke Detached. Confirm the playing media is selected.
   If the source page offers an **Open Detached mini player** button, click it.
2. Minimize the source browser window and switch to another desktop app.
   Confirm the floating window stays visible and the original track or video
   advances without duplicate audio.
3. Test play/pause and return to tab. For audio, also test seeking and volume.
   Close the mini player and verify the source remains usable.
4. Replace the playing element while the player is open. Check that audio
   reconnects when there is one clear successor, or prompts for selection when
   there are several. For video, use the page button to reopen the replacement.
5. Try a page with no media, a cross-origin embed, and a restricted browser page.
   Confirm the popup explains how to proceed without asking for site-wide access.

Include the browser version, operating system, source type, and any variations
when reporting results. See the [roadmap](docs/ROADMAP.md) for target sites.

Contributions are submitted under the project's Apache-2.0 license.
