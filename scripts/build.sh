#!/usr/bin/env bash
# Uso: scripts/build.sh <full|store> <outdir>
# Única fonte da lista de arquivos do pacote. Saída em <outdir>/speedia (full)
# ou <outdir>/speedia-store e <outdir>/speedia-store-firefox (store).
set -euo pipefail

edition=${1:?uso: build.sh <full|store> <outdir>}
out=${2:?uso: build.sh <full|store> <outdir>}
cd "$(dirname "$0")/.."

FILES=(manifest.json edition.js background.js content.js inject.js shortcuts.js popup.html popup.js popup-theme.js welcome.html welcome.css welcome.js icons _locales)

pack() { mkdir -p "$1" && cp -r "${FILES[@]}" "$1/"; }

case "$edition" in
  full) rm -rf "$out/speedia"; pack "$out/speedia" ;;
  store)
    rm -rf "$out/speedia-store" "$out/speedia-store-firefox"
    pack "$out/speedia-store"
    echo "globalThis.SPEEDIA_EDITION = 'store';" > "$out/speedia-store/edition.js"
    m="$out/speedia-store/manifest.json"
    jq '.permissions -= ["downloads"] | .description = "__MSG_extDescriptionStore__"' "$m" > "$m.tmp" && mv "$m.tmp" "$m"
    cp -r "$out/speedia-store" "$out/speedia-store-firefox"
    # browser_specific_settings é só do Firefox: sai do pacote Chrome.
    jq 'del(.browser_specific_settings)' "$m" > "$m.tmp" && mv "$m.tmp" "$m"
    m="$out/speedia-store-firefox/manifest.json"
    jq 'del(.browser_specific_settings.gecko.update_url)' "$m" > "$m.tmp" && mv "$m.tmp" "$m"
    ;;
  *) echo "edição inválida: $edition (use full ou store)" >&2; exit 1 ;;
esac
