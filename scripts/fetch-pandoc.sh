#!/usr/bin/env bash
# Baixa o pandoc (Linux amd64) como RESOURCE do Tauri em
# src-tauri/binaries/pandoc/pandoc (mesma pegada do ffmpeg deste app — rodado
# por std::process::Command, não sidecar).
# Uso: bash scripts/fetch-pandoc.sh
set -euo pipefail

# ---------------------------------------------------------------------------
# VERSÃO FIXA + SHA256 (espelhados no Local-runtimes v1, iguais aos do
# LocalOffice). Versão de pandoc pode MUDAR o resultado da conversão do
# usuário, então nada de `latest`. PRA ATUALIZAR: trocar aqui E no .ps1.
# ---------------------------------------------------------------------------
PD_VERSION="3.10"
PD_ASSET="pandoc-3.10-linux-amd64.tar.gz"
PD_SHA256="e0f8af62d0f267d22baa5bcefe6d5dda3a097ccc60de794b759fe03159923244"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT/src-tauri/binaries/pandoc"
TARGET="$BIN_DIR/pandoc"
mkdir -p "$BIN_DIR"

if [ -f "$TARGET" ]; then
  echo "pandoc já existe em $TARGET"
  exit 0
fi

URL="https://github.com/Anon5T4R/Local-runtimes/releases/download/v1/$PD_ASSET"
echo "Baixando $URL ..."
curl -fsSL --retry 3 --retry-delay 2 "$URL" -o /tmp/pandoc.tar.gz

# Confere ANTES de extrair: binário adulterado não chega a ser descompactado.
GOT=$(sha256sum /tmp/pandoc.tar.gz | cut -d' ' -f1)
if [ "$GOT" != "$PD_SHA256" ]; then
  rm -f /tmp/pandoc.tar.gz
  echo "SHA256 NAO BATE!" >&2
  echo "  esperado: $PD_SHA256" >&2
  echo "  recebido: $GOT" >&2
  echo "Download corrompido ou adulterado. Nada foi instalado." >&2
  exit 1
fi
echo "sha256 conferido: $GOT"

rm -rf /tmp/pandoc-extract
mkdir -p /tmp/pandoc-extract
tar xzf /tmp/pandoc.tar.gz -C /tmp/pandoc-extract
PANDOC=$(find /tmp/pandoc-extract -type f -name pandoc -path '*bin*' | head -1)
[ -z "$PANDOC" ] && { echo "pandoc não encontrado no tarball ($PD_VERSION)"; exit 1; }
cp "$PANDOC" "$TARGET"
chmod +x "$TARGET"
rm -rf /tmp/pandoc.tar.gz /tmp/pandoc-extract
echo "Instalado: $TARGET ($PD_VERSION)"
