# LocalConverter

**Conversor universal de arquivos 100% offline.** Arraste uma pilha de arquivos, escolha o
formato de destino de cada um (ou de todos), e converta — em lote, na sua máquina, sem nenhum
arquivo sair do computador.

Parte da suíte **Local/Taylor** de aplicativos offline-first.

## O papel dele na suíte

A régua entre os três apps de mídia (decisão registrada em `dev-notes/docs/ESTADO.md`):

- **LocalConverter — LARGURA de formatos.** "Tenho arquivos de tipos misturados e quero todos
  noutro formato." Muitos tipos, em lote. É o que você abre quando o problema é *"preciso
  converter isto"*.
- **[LocalMedia](https://github.com/Anon5T4R/LocalMedia) — PROFUNDIDADE de operações de mídia.**
  Cortar, GIF, normalizar volume, logo, silêncio — mexer no conteúdo de um vídeo/áudio.
- **[LocalVideo](https://github.com/Anon5T4R/LocalVideo) — PROFUNDIDADE de edição.** Timeline,
  camadas, transições.

A sobreposição em *conversão de mídia* entre Converter e Media é **de propósito**: quem quer
converter abre o Converter e acha. A lógica de args do ffmpeg é a mesma dos dois (a suíte
compartilha a pegada, não reimplementa).

## Estado

**v0.1.0 — foundation.** Converte **vídeo, áudio e imagem** via ffmpeg embarcado, em lote, com
fila de progresso real e cancelamento. Cada arquivo mostra os formatos de destino da sua família
(sem o que ele já é); a saída fica ao lado do original.

- **Vídeo** → MP4 (H.264) · WebM (VP9) · MKV (sem recodificar) · extrair áudio (MP3/M4A).
- **Áudio** → MP3 · M4A · Opus · OGG · FLAC · WAV.
- **Imagem** → PNG · JPG · WebP · BMP · TIFF.
- Tema claro/escuro (+ 5 nomeados) e interface em **PT / EN / ES**.

### O que vem a seguir

- **Documentos** (docx/odt/md/html/pptx → PDF e entre si): via **pandoc** (que a suíte já embute
  no LocalOffice) + **impressão-para-PDF do próprio WebView** — o mesmo caminho que o LocalOffice
  usa, sem bundlar LaTeX nem LibreOffice. Hoje um documento aparece na lista com aviso honesto de
  "ainda não sei converter".
- Compartilhar o motor de presets de mídia com o LocalMedia num módulo comum.
- CI/release, ícone próprio e entrada no TaylorHub.

## Desenvolvimento

Stack: Tauri 2 + React 19 + Vite + TypeScript (front) e Rust (back). Porta dev **1468**.

```bash
npm install
powershell -ExecutionPolicy Bypass -File scripts/fetch-ffmpeg.ps1   # Windows
bash scripts/fetch-ffmpeg.sh                                        # Linux
npm run tauri dev
npm test          # vitest (front); cargo test roda no CI
```

## Créditos e licença

- [FFmpeg](https://ffmpeg.org) faz a conversão de mídia — build GPL do
  [BtbN](https://github.com/BtbN/FFmpeg-Builds). O FFmpeg é licenciado sob GPL/LGPL; o código deste
  app é [MIT](LICENSE) e o conjunto distribuído respeita a GPL do binário do FFmpeg.
