/** Ponte fina com o Rust (ffmpeg). Fora do Tauri (npm run dev no navegador) os
 *  comandos não existem — `inTauri()` deixa a UI degradar sem quebrar. */
import { invoke } from "@tauri-apps/api/core";

export function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function ffmpegOk(): Promise<boolean> {
  if (!inTauri()) return false;
  try {
    return await invoke<boolean>("ffmpeg_ok");
  } catch {
    return false;
  }
}

/** JSON cru do ffprobe (formato + streams). O parse mínimo mora no front. */
export async function mediaProbe(path: string): Promise<string> {
  return invoke<string>("media_probe", { path });
}

/** Duração em ms a partir do JSON do ffprobe. 0 = sem duração (imagem). */
export function durationMsFromProbe(json: string): number {
  try {
    const v = JSON.parse(json) as { format?: { duration?: string } };
    const s = parseFloat(v.format?.duration ?? "0");
    return Number.isFinite(s) && s > 0 ? Math.round(s * 1000) : 0;
  } catch {
    return 0;
  }
}

/** Roda um job do ffmpeg (args prontos). O progresso chega por evento
 *  "ffjob-progress" (ver o store). Resolve quando termina; rejeita com a
 *  mensagem do ffmpeg em caso de erro. */
export async function ffRun(jobId: string, args: string[]): Promise<void> {
  await invoke("ff_run", { jobId, args });
}

export async function ffCancel(jobId: string): Promise<void> {
  await invoke("ff_cancel", { jobId });
}

/** Caminho livre (acrescenta " (n)" se já existir). */
export async function uniquePath(path: string): Promise<string> {
  if (!inTauri()) return path;
  try {
    return await invoke<string>("unique_path", { path });
  } catch {
    return path;
  }
}
