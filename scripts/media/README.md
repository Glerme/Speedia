# Mídia do README

Gera `docs/media/*` (overlay, popup claro/escuro, welcome e os 3 GIFs) a partir do código real da extensão, com um stub de `chrome.*` e um vídeo de demo criado pelo ffmpeg.

Requisitos: Node 18+, ffmpeg e Chrome (`/usr/bin/google-chrome-stable`, ou defina `CHROME_PATH`).

```sh
npm ci && npm run build   # na raiz: o servidor da demo serve dist/
cd scripts/media
npm ci && node build.mjs
```
