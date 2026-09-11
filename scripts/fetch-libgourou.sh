#!/usr/bin/env bash
# Baixa os utils do libgourou (Linux amd64) como RESOURCE do Tauri em
# src-tauri/binaries/libgourou/. O libgourou é o motor do ACSM do
# LocalConverter (adept_activate / acsmdownloader / adept_remove) — roda como
# PROCESSO SEPARADO via std::process::Command, nunca linkado (lib LGPL-3.0,
# utils BSD-3-Clause).
# Uso: bash scripts/fetch-libgourou.sh
set -euo pipefail

# ---------------------------------------------------------------------------
# VERSÃO FIXA + SHA256 (libgourou 0.8.10). PRA ATUALIZAR: trocar aqui E no .ps1.
#
# O Linux usa o AppImage oficial do upstream (soutade.fr/files), espelhado no
# Anon5T4R/Local-runtimes. Enquanto o espelho não publicar o artefato, o sha256
# fica PENDENTE e este script se recusa a baixar (política sem fallback:
# espelho cai → build falha alto — ver docs/planos/espelho-de-binarios.md).
# ---------------------------------------------------------------------------
LG_VERSION="0.8.10"
LG_ASSET="libgourou_utils-$LG_VERSION-x86_64.AppImage.tar.gz"
LG_SHA256="b8f34e95052fe2b4a7e956afb6c1baae7d7becabe62eb795cf610af5b6f3da93"  # AppImage oficial espelhado

# Tag da release do espelho que hospeda o artefato (decisão do João; o
# Local-runtimes usa uma release por "conjunto": v1, v2...). Trocar aqui E no .ps1.
MIRROR_TAG="v1"  # release do espelho que publica o libgourou

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT/src-tauri/binaries/libgourou"
mkdir -p "$BIN_DIR"

# Guarda: os três utils já instalados → não refaz o download.
MISSING=0
for bin in adept_activate acsmdownloader adept_remove; do
  [ -f "$BIN_DIR/$bin" ] || MISSING=1
done
if [ "$MISSING" -eq 0 ]; then
  echo "libgourou já existe em $BIN_DIR"
  exit 0
fi

# Portão de supply-chain: sha256 ainda não fixado = espelho ainda não publicou.
# NÃO baixa nada — nunca baixar sem conferir.
if [ "$LG_SHA256" = "PENDENTE" ]; then
  echo "sha256 do libgourou ainda é PENDENTE. Falta publicar o artefato no espelho Anon5T4R/Local-runtimes (release $MIRROR_TAG), depois preencher LG_SHA256 no topo deste script e no fetch-libgourou.ps1." >&2
  exit 1
fi

URL="https://github.com/Anon5T4R/Local-runtimes/releases/download/$MIRROR_TAG/$LG_ASSET"
echo "Baixando $URL ..."
curl -fsSL --retry 3 --retry-delay 2 "$URL" -o /tmp/libgourou.tar.gz

# Confere ANTES de extrair: binário adulterado não chega a ser descompactado.
GOT=$(sha256sum /tmp/libgourou.tar.gz | cut -d' ' -f1)
if [ "$GOT" != "$LG_SHA256" ]; then
  rm -f /tmp/libgourou.tar.gz
  echo "SHA256 NAO BATE!" >&2
  echo "  esperado: $LG_SHA256" >&2
  echo "  recebido: $GOT" >&2
  echo "Download corrompido ou adulterado. Nada foi instalado." >&2
  exit 1
fi
echo "sha256 conferido: $GOT"

rm -rf /tmp/libgourou-extract
mkdir -p /tmp/libgourou-extract
tar xzf /tmp/libgourou.tar.gz -C /tmp/libgourou-extract

# O tarball traz o AppImage + symlinks dos utils apontando pra ele (ex.:
# acsmdownloader -> libgourou_utils-0.8.10-x86_64.AppImage); o AppImage
# despacha pelo nome invocado (argv[0]). Copia o AppImage e os symlinks.
APPIMAGE=$(find /tmp/libgourou-extract -type f -name "*.AppImage" | head -1)
[ -z "$APPIMAGE" ] && { echo "AppImage do libgourou não encontrado no tarball ($LG_VERSION)"; exit 1; }
cp -a "$APPIMAGE" "$BIN_DIR/"

for bin in adept_activate acsmdownloader adept_remove; do
  HIT=$(find /tmp/libgourou-extract \( -type f -o -type l \) -name "$bin" | head -1)
  [ -z "$HIT" ] && { echo "$bin não encontrado no tarball ($LG_VERSION)"; exit 1; }
  cp -a "$HIT" "$BIN_DIR/$bin"
  chmod +x "$BIN_DIR/$bin"
done
chmod +x "$BIN_DIR/$(basename "$APPIMAGE")"

rm -rf /tmp/libgourou.tar.gz /tmp/libgourou-extract
echo "Instalado em $BIN_DIR ($LG_VERSION)"