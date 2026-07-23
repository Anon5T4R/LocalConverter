#!/usr/bin/env bash
# Baixa o typst (Linux amd64/musl) como RESOURCE do Tauri em
# src-tauri/binaries/typst/typst. É o MOTOR DE PDF do pandoc (docx/md → PDF sem
# LaTeX): pandoc chama `--pdf-engine=<este binário>`. Binário único, ~30MB.
# Uso: bash scripts/fetch-typst.sh
set -euo pipefail

# VERSÃO FIXA + SHA256 (typst 0.15.1). PRA ATUALIZAR: trocar aqui E no .ps1.
TY_VERSION="0.15.1"
TY_ASSET="typst-x86_64-unknown-linux-musl.tar.xz"
TY_SHA256="a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT/src-tauri/binaries/typst"
TARGET="$BIN_DIR/typst"
mkdir -p "$BIN_DIR"

if [ -f "$TARGET" ]; then
  echo "typst já existe em $TARGET"
  exit 0
fi

URL="https://github.com/typst/typst/releases/download/v$TY_VERSION/$TY_ASSET"
echo "Baixando $URL ..."
curl -fsSL --retry 3 --retry-delay 2 "$URL" -o /tmp/typst.tar.xz

GOT=$(sha256sum /tmp/typst.tar.xz | cut -d' ' -f1)
if [ "$GOT" != "$TY_SHA256" ]; then
  rm -f /tmp/typst.tar.xz
  echo "SHA256 NAO BATE!" >&2
  echo "  esperado: $TY_SHA256" >&2
  echo "  recebido: $GOT" >&2
  exit 1
fi
echo "sha256 conferido: $GOT"

rm -rf /tmp/typst-extract
mkdir -p /tmp/typst-extract
tar xJf /tmp/typst.tar.xz -C /tmp/typst-extract
TYPST=$(find /tmp/typst-extract -type f -name typst | head -1)
[ -z "$TYPST" ] && { echo "typst não encontrado no tarball ($TY_VERSION)"; exit 1; }
cp "$TYPST" "$TARGET"
chmod +x "$TARGET"
rm -rf /tmp/typst.tar.xz /tmp/typst-extract
echo "Instalado: $TARGET ($TY_VERSION)"
