# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Speedia is a Manifest V3 browser extension (Chrome 121+, Firefox 128+) that adds a speed bar, mute, PiP/mini player and video download to Instagram, X/Twitter, TikTok, Facebook and Reddit. TypeScript in `src/`, bundled by esbuild into `dist/`. Code comments, commit messages, CHANGELOG and scripts are written in Portuguese (pt-BR).

## Commands

- `npm ci` — install (only devDeps: esbuild, typescript, @types/chrome).
- `npm run build` — wipes and rebuilds `dist/` (`build.mjs`). Load `dist/` as an unpacked extension (`chrome://extensions`) or temporary add-on (`about:debugging#/runtime/this-firefox`).
- `npm run watch` — rebuild on change, including `static/` and popup/welcome HTML/CSS.
- `npm run typecheck` — `tsc --noEmit`. No linter.
- `npm test` — runs `scripts/test-tab-pip.mjs` (tab-switch PiP handler), `scripts/test-multisite.mjs`, `scripts/test-media-sites.mjs` and `scripts/test-inject-sites.mjs` (mock-based self-checks; the only automated tests). Otherwise typecheck + manual load in the browser is the verification.
- `scripts/build.sh <full|store> <outdir>` — packaged editions (needs `jq`; `outdir` must not be `dist`).
- `scripts/media/` — regenerates `docs/media/*` screenshots/GIFs from the real build (needs ffmpeg + Chrome; see its README).

## Architecture

Each entry point in `build.mjs` becomes an IIFE bundle in `dist/`; `static/` (manifest, `_locales`, icons, `edition.js`) and the popup/welcome HTML/CSS are copied as-is.

- **`src/inject/`** — content script in the page's `MAIN` world, at `document_start`. Wraps `fetch`/`XMLHttpRequest` and scans Instagram/X/TikTok/Facebook API JSON (and IG's embedded `script[type=application/json]`) for real `.mp4` URLs, since `<video>` uses `blob:`. Records are `{id:'tt:<id>'|'fb:<id>', keys:[<video id>], duration (s or null), url}`. Sends them to the isolated content script via `window` `CustomEvent('speedia:media')`. Also patches `HTMLMediaElement.prototype.pause` to ignore site-initiated pauses on videos marked `data-speedia-pin="1"` (the mini player / PiP video).
- **`src/content/`** — isolated-world content script. `state.ts` holds shared mutable state and constants, including `site` (`'ig'|'x'|'tiktok'|'fb'|'reddit'`, replaces `isIG`); the bar UI is identical on every site, with no per-site CSS/layout; `ui.ts` builds the bar in a closed shadow root (`#speedia-host`); `loop.ts` is the rAF positioning/occlusion/auto-PiP loop (sets/clears `speediaPin`); `pip.ts` mini player, native PiP and the tab-switch auto-PiP handler (`navigator.mediaSession.setActionHandler('enterpictureinpicture')`, registered only while `tabPip` is on; Chrome-only, no-op where unsupported); `media.ts` matches captured media to `<video>` elements and requests downloads (on Reddit the mp4 comes from the `packaged-media-json` attribute of `shreddit-player`/`shreddit-player-2`, not from inject); `allVideos()` returns `document.querySelectorAll('video')` plus, on Reddit only, videos in open shadow roots cached by `refreshPlayerRoots()` on the 1s tick in `events.ts` (never a full DOM scan per frame); `events.ts` wires input, shortcuts and `chrome.storage` sync.
- **`src/background/`** — service worker (Firefox uses `background.scripts`). Handles `{type:'download'}` messages, validating the URL is `https:` on an allowlisted CDN (`cdninstagram.com`, `fbcdn.net`, `twimg.com`, `tiktokcdn.com`, `tiktokcdn-us.com`, `tiktokv.com`, `redd.it`) before `chrome.downloads`. Opens the welcome page on first install.
- **`src/popup/`**, **`src/welcome/`** — extension pages. `popup-theme.js` (`theme-entry.ts`) runs before `popup.js` to apply the theme synchronously from a `localStorage` mirror (`speediaLook`), avoiding a flash, because `chrome.storage` is async.
- **`src/shared/`** — `i18n.ts` (`speediaMsg`, `speediaApplyI18n` for `data-i18n*` attributes) and `shortcuts.ts` (action list, default combos, combo format like `Ctrl+Shift+KeyF` using `KeyboardEvent.code`; empty string = disabled).

### Cross-cutting contracts

- **Tab-switch PiP needs a Chrome site permission** (Automatic picture-in-picture) that extensions cannot set; the popup's "Allow this site" button (`allowSite` in `popup.ts`, hidden without PiP support) opens `chrome://settings/content/siteDetails?site=<origin>` (IG/X/TikTok/Facebook/Reddit only, https) or the generic `autoPictureInPicture` page via `chrome.tabs.create`, using the `activeTab` permission to read the active tab URL.
- **Settings** live in `chrome.storage.sync`: `autoPip`, `tabPip` (PiP on tab switch, default `false`), `shortcuts`, `theme` (`auto|light|dark`), `accent`. Content script, popup and welcome page each read them and listen to `storage.onChanged`, so changing a key's shape means updating all three.
- **Editions**: `static/edition.js` sets `globalThis.SPEEDIA_EDITION = 'full'`; `scripts/build.sh store` overwrites it with `'store'`, drops the `downloads` permission and swaps the description. Every download-related path (inject capture, content download button, background listener, welcome feature item) checks `SPEEDIA_EDITION === 'store'` — new download features must too. `edition.js` is loaded before each bundle via the manifest / HTML `<script>` tags.
- **i18n**: all user-facing strings go through `_locales/{en,pt_BR}/messages.json`; add keys to both.
- **Firefox**: no PiP API for pages/extensions (`canPip` in `state.ts`), so the mini player is the fallback. `browser_specific_settings` is stripped from the Chrome store package.

## Documentation rule

Every new feature must, in the same change, update:
- this `CLAUDE.md` (architecture, contracts or commands it affects);
- both READMEs, `README.md` (English) and `README.pt-BR.md` (Portuguese), keeping them in sync (Features list, and Usage/shortcuts/etc. when relevant);
- `CHANGELOG.md`, with an entry under the upcoming version's `## <version> — <date>` section (create it if missing; written in Portuguese like the existing entries).

## Release

Pushing a `v*` tag runs `.github/workflows/release.yml`. It fails unless `static/manifest.json` `version` matches the tag and `CHANGELOG.md` has a `## <version> — <date>` section (its text becomes the release notes). It builds full + store zips, signs a Firefox `.xpi` if AMO secrets exist, and publishes `updates.json` for Firefox auto-update. A version bump = edit `static/manifest.json` + add the CHANGELOG section.
