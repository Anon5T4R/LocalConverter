/**
 * A MATRIZ de conversão — o coração do LocalConverter. Funções PURAS
 * (unit-testadas); o Rust só resolve o ffmpeg e move bytes.
 *
 * Cada família de entrada (vídeo/áudio/imagem) tem uma lista de formatos-ALVO,
 * e cada alvo sabe montar os args do ffmpeg pra si. É de propósito uma tabela
 * declarativa: adicionar um formato é uma linha, e a mesma lista alimenta a UI
 * (o seletor de "converter para") e o job.
 *
 * Régua da suíte: o Converter cobre em LARGURA (muitos formatos, em lote);
 * mexer no conteúdo (cortar, logo, silêncio) é o LocalMedia; editar é o
 * LocalVideo. A lógica de args de mídia é a MESMA do Media — quando os dois
 * apps convergirem num módulo compartilhado, é aqui que ele encaixa.
 */

/** A família de um arquivo, por extensão. `null` = não sabemos converter (ainda
 *  — documentos entram numa próxima leva). */
export type Kind = "video" | "audio" | "image";

const VIDEO_EXT = ["mp4", "mkv", "webm", "avi", "mov", "m4v", "mpg", "mpeg", "ts", "wmv", "flv", "3gp", "gif"];
const AUDIO_EXT = ["mp3", "m4a", "m4b", "aac", "ogg", "oga", "opus", "flac", "wav", "wma", "mka"];
const IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "bmp", "tif", "tiff"];

/** Todas as extensões que o app aceita hoje (filtro do diálogo / drag&drop). */
export const ALL_INPUT_EXT = [...VIDEO_EXT, ...AUDIO_EXT, ...IMAGE_EXT];

export function extOf(path: string): string {
  return path.split(".").pop()?.toLowerCase() ?? "";
}

/** A família do arquivo pela extensão. `gif` conta como vídeo (animado): assim
 *  dá pra convertê-lo pra mp4/webm. */
export function kindOf(path: string): Kind | null {
  const ext = extOf(path);
  if (VIDEO_EXT.includes(ext)) return "video";
  if (AUDIO_EXT.includes(ext)) return "audio";
  if (IMAGE_EXT.includes(ext)) return "image";
  return null;
}

/** Um formato de destino: rótulo (técnico, não se traduz — "MP4" é "MP4"), a
 *  extensão de saída, e os args do ffmpeg (sem `-y`/`-progress`, que o Rust
 *  injeta). O input é UM `-i`; a saída é o último arg. */
export interface Target {
  id: string;
  label: string;
  ext: string;
  args(inPath: string, outPath: string): string[];
}

const i = (p: string) => ["-i", p];

/** Alvos de VÍDEO — incluindo extrair só o áudio (troca de família proposital:
 *  "quero o MP3 desse vídeo" é conversão, não edição). */
// Os `label` são nomes de formato PUROS — endônimos técnicos, iguais em
// qualquer idioma ("MP4" é "MP4"). Descritores tipo "sem recodificar"/"só
// áudio" ficaram FORA de propósito: eram texto que precisaria traduzir (e
// vazava PT no modo EN). Quando entrar uma dica por formato, ela vem por i18n,
// não colada no nome.
const VIDEO_TARGETS: Target[] = [
  {
    id: "mp4", label: "MP4", ext: "mp4",
    args: (p, o) => [...i(p), "-c:v", "libx264", "-crf", "23", "-preset", "veryfast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", o],
  },
  {
    id: "webm", label: "WebM", ext: "webm",
    args: (p, o) => [...i(p), "-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-row-mt", "1", "-cpu-used", "4", "-c:a", "libopus", "-b:a", "96k", o],
  },
  {
    id: "mkv", label: "MKV", ext: "mkv",
    args: (p, o) => [...i(p), "-map", "0", "-c", "copy", o],
  },
  {
    id: "mp3", label: "MP3", ext: "mp3",
    args: (p, o) => [...i(p), "-vn", "-c:a", "libmp3lame", "-q:a", "2", o],
  },
  {
    id: "m4a", label: "M4A", ext: "m4a",
    args: (p, o) => [...i(p), "-vn", "-c:a", "aac", "-b:a", "192k", o],
  },
];

/** Alvos de ÁUDIO. */
const AUDIO_TARGETS: Target[] = [
  { id: "mp3", label: "MP3", ext: "mp3", args: (p, o) => [...i(p), "-vn", "-c:a", "libmp3lame", "-q:a", "2", o] },
  { id: "m4a", label: "M4A", ext: "m4a", args: (p, o) => [...i(p), "-vn", "-c:a", "aac", "-b:a", "192k", o] },
  { id: "opus", label: "Opus", ext: "opus", args: (p, o) => [...i(p), "-vn", "-c:a", "libopus", "-b:a", "128k", o] },
  { id: "ogg", label: "OGG", ext: "ogg", args: (p, o) => [...i(p), "-vn", "-c:a", "libvorbis", "-q:a", "5", o] },
  { id: "flac", label: "FLAC", ext: "flac", args: (p, o) => [...i(p), "-vn", "-c:a", "flac", o] },
  { id: "wav", label: "WAV", ext: "wav", args: (p, o) => [...i(p), "-vn", "-c:a", "pcm_s16le", o] },
];

/** Alvos de IMAGEM (o ffmpeg lê/escreve imagem parada como 1 quadro). */
const IMAGE_TARGETS: Target[] = [
  { id: "png", label: "PNG", ext: "png", args: (p, o) => [...i(p), o] },
  { id: "jpg", label: "JPG", ext: "jpg", args: (p, o) => [...i(p), "-q:v", "3", o] },
  { id: "webp", label: "WebP", ext: "webp", args: (p, o) => [...i(p), "-c:v", "libwebp", "-q:v", "80", o] },
  { id: "bmp", label: "BMP", ext: "bmp", args: (p, o) => [...i(p), o] },
  { id: "tiff", label: "TIFF", ext: "tiff", args: (p, o) => [...i(p), o] },
];

const TARGETS: Record<Kind, Target[]> = {
  video: VIDEO_TARGETS,
  audio: AUDIO_TARGETS,
  image: IMAGE_TARGETS,
};

/** Os formatos-alvo pra um arquivo, sem o que ele JÁ é (converter mp3→mp3 não é
 *  conversão). `null` se a família for desconhecida. */
export function targetsFor(path: string): Target[] | null {
  const kind = kindOf(path);
  if (!kind) return null;
  const curExt = extOf(path);
  // "jpg" e "jpeg" são o mesmo formato — não oferecer jpg pra um .jpeg.
  const sameExt = (a: string, b: string) =>
    a === b || (a === "jpg" && b === "jpeg") || (a === "jpeg" && b === "jpg") || (a === "tif" && b === "tiff") || (a === "tiff" && b === "tif");
  return TARGETS[kind].filter((t) => !sameExt(t.ext, curExt));
}

/** Acha um alvo pelo id dentro da família de um arquivo. */
export function targetById(path: string, id: string): Target | undefined {
  return targetsFor(path)?.find((t) => t.id === id);
}
