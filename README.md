<p align="center">
  <img src="icons/icon128.png" alt="Speedia icon" width="96">
</p>

<h1 align="center">Speedia</h1>

<p align="center">
  Speed control, mini player and download for videos on Instagram and X (Twitter).
</p>

<p align="center">
  <a href="https://github.com/Glerme/Speedia/releases/latest"><img src="https://img.shields.io/github/v/release/Glerme/Speedia?label=release" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/Chrome-121%2B-4285F4?logo=googlechrome&logoColor=white" alt="Chrome 121+">
  <img src="https://img.shields.io/badge/Firefox-128%2B-FF7139?logo=firefoxbrowser&logoColor=white" alt="Firefox 128+">
</p>

<p align="center">English · <a href="README.pt-BR.md">Português</a></p>

<p align="center">
  <img src="docs/media/speed.gif" alt="Changing the playback speed with the Speedia bar over a video" width="640">
</p>

## Features

- Playback speed from 0.5x to 3x, from a glass bar over the video.
- Mute and Picture-in-Picture buttons on the same bar.
- Auto PiP: a mini player appears when you scroll past a video that is playing with sound.
- Video download.
- Configurable keyboard shortcuts.
- Light, dark or automatic theme, with a customizable main color.
- The bar stays visible in fullscreen on X.
- Welcome page on install.
- Portuguese (BR) and English.

Works on Instagram and X/Twitter. Requires Chrome 121+ or Firefox 128+.

## Install

### Chrome

1. Download `speedia-vX.zip` from the [latest release](https://github.com/Glerme/Speedia/releases/latest) and extract it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the extracted `speedia` folder.
4. Reload any Instagram or X tabs that are already open.

### Firefox

Open the signed `.xpi` from the [latest release](https://github.com/Glerme/Speedia/releases/latest) in Firefox and confirm the installation. It updates itself on every new release.

### Editions

- **Full** (GitHub releases): includes video downloads.
- **Store** (Chrome Web Store / AMO): same extension without video downloads and without the `downloads` permission.

Build either one with `scripts/build.sh <full|store> <outdir>` (e.g. `scripts/build.sh store dist` → `dist/speedia-store` and `dist/speedia-store-firefox`).

## Usage

Open a video on Instagram or X. The Speedia bar appears over it with the speed options (0.5x to 3x) and the mute, PiP, Auto PiP and download buttons.

<p align="center">
  <img src="docs/media/overlay.png" alt="Speedia bar over a video, showing the speed options and the mute, PiP, Auto PiP and download buttons" width="480">
</p>

- **Mini player:** with Auto PiP on, scrolling past a video that is playing with sound keeps it playing in a mini player.

  <p align="center">
    <img src="docs/media/mini-player.gif" alt="Video continuing to play in a mini player after scrolling past it" width="480">
  </p>

- **Download:** the download button saves the video as an `.mp4` file.
- **Fullscreen:** the bar stays visible in fullscreen on X. Press `F` to toggle fullscreen.

## Keyboard shortcuts

| Action | Default |
| --- | --- |
| Fullscreen | `F` |
| Mute / unmute | `M` |
| Increase speed | `Shift` + `.` |
| Decrease speed | `Shift` + `,` |
| Reset speed | `Shift` + `1` |

You can change or disable any shortcut in the popup (click the Speedia icon in the toolbar). The popup warns about conflicts and lets you undo.

## Appearance

In the popup, choose the theme (Auto, Light or Dark) and the main color, from 8 presets or a color wheel. The bar over the video and the welcome page follow your choice.

<p align="center">
  <img src="docs/media/appearance.gif" alt="Changing the theme and main color in the Speedia popup" width="320">
</p>

<p align="center">
  <img src="docs/media/popup-dark.png" alt="Speedia popup with the dark theme" width="280">
  <img src="docs/media/popup-light.png" alt="Speedia popup with the light theme" width="280">
</p>

## Welcome page

A small page opens after installation, listing the features and shortcuts.

<p align="center">
  <img src="docs/media/welcome.png" alt="Speedia welcome page" width="360">
</p>

## Privacy

Speedia does not collect any data and has no servers. Everything runs in your browser. It requests only two permissions: `downloads` (to save videos) and `storage` (to keep your settings). On Firefox, the manifest declares `data_collection_permissions: none`.

## Development

- **Run locally:** run `npm ci` and `npm run build` (or `npm run watch`), then load the `dist/` folder as an unpacked extension (`chrome://extensions` → Developer mode → Load unpacked; in Firefox, `about:debugging#/runtime/this-firefox` → Load Temporary Add-on).
- **Media:** the images and GIFs in `docs/media/` are regenerated with the scripts in `scripts/media`.
- **Release:** pushing a `v*` tag triggers [`release.yml`](.github/workflows/release.yml), which publishes the Chrome zip and the signed Firefox `.xpi`, plus `updates.json` for automatic updates. The release only goes out if `CHANGELOG.md` has a `## <version>` section for it, and the `version` in `static/manifest.json` must match the tag (e.g. tag `v1.4.0` ↔ version `1.4.0`).
