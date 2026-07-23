import { listen } from "@tauri-apps/api/event";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { create } from "zustand";

import * as be from "../lib/backend";
import { extOf, kindOf, targetById, targetsFor, type Kind } from "../lib/formats";

export interface ConvFile {
  id: string;
  path: string;
  name: string;
  kind: Kind | null;
  /** Id do formato-alvo escolhido (padrão = 1º da lista da família). */
  targetId: string;
  /** Duração em ms (pro % de progresso); 0 = imagem/indeterminado. */
  durationMs: number;
}

export type JobStatus = "waiting" | "running" | "done" | "error" | "cancelled";

export interface Job {
  id: string;
  fileName: string;
  targetLabel: string;
  outPath: string;
  denomMs: number;
  status: JobStatus;
  pct: number;
  speed: string;
  error?: string;
}

interface StoreState {
  files: ConvFile[];
  jobs: Job[];
  runtimeOk: boolean;
  running: boolean;
  init: () => Promise<void>;
  addPaths: (paths: string[]) => Promise<void>;
  setTarget: (fileId: string, targetId: string) => void;
  removeFile: (id: string) => void;
  convertAll: () => Promise<void>;
  cancel: (jobId: string) => void;
  clearFinished: () => void;
  showInFolder: (path: string) => void;
}

let seq = 0;
const newId = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
function dirName(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(0, i) : "";
}
function stemOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export const useStore = create<StoreState>((set, get) => ({
  files: [],
  jobs: [],
  runtimeOk: true,
  running: false,

  init: async () => {
    set({ runtimeOk: await be.ffmpegOk() });
    // Progresso dos jobs: o Rust emite "ffjob-progress" com out_time_ms.
    if (be.inTauri()) {
      void listen<{ jobId: string; outTimeMs: number; speed: string }>("ffjob-progress", (e) => {
        const { jobId, outTimeMs, speed } = e.payload;
        set((s) => ({
          jobs: s.jobs.map((j) => {
            if (j.id !== jobId) return j;
            const pct = j.denomMs > 0 ? Math.min(99, Math.round((outTimeMs / j.denomMs) * 100)) : j.pct;
            return { ...j, pct, speed };
          }),
        }));
      });
    }
  },

  addPaths: async (paths) => {
    const known = paths.filter((p) => kindOf(p) !== null || true); // aceita todos, marca desconhecido
    const files: ConvFile[] = [];
    for (const path of known) {
      const kind = kindOf(path);
      const targets = targetsFor(path);
      let durationMs = 0;
      if (kind === "video" || kind === "audio") {
        try {
          durationMs = be.durationMsFromProbe(await be.mediaProbe(path));
        } catch {
          durationMs = 0;
        }
      }
      files.push({
        id: newId(),
        path,
        name: baseName(path),
        kind,
        targetId: targets && targets[0] ? targets[0].id : "",
        durationMs,
      });
    }
    set((s) => ({ files: [...s.files, ...files] }));
  },

  setTarget: (fileId, targetId) => {
    set((s) => ({ files: s.files.map((f) => (f.id === fileId ? { ...f, targetId } : f)) }));
  },

  removeFile: (id) => {
    set((s) => ({ files: s.files.filter((f) => f.id !== id) }));
  },

  convertAll: async () => {
    if (get().running) return;
    const files = get().files.filter((f) => f.kind && f.targetId);
    if (files.length === 0) return;

    // Monta os jobs (um por arquivo) e enfileira.
    const jobs: Job[] = [];
    for (const f of files) {
      const target = targetById(f.path, f.targetId);
      if (!target) continue;
      const outName = `${stemOf(f.name)}.${target.ext}`;
      const want = `${dirName(f.path)}/${outName}`.replace(/\//g, "\\");
      const outPath = await be.uniquePath(want);
      jobs.push({
        id: newId(),
        fileName: f.name,
        targetLabel: target.label,
        outPath,
        denomMs: f.durationMs,
        status: "waiting",
        pct: 0,
        speed: "",
      });
    }
    set((s) => ({ jobs: [...s.jobs, ...jobs], running: true }));

    // Executa SEQUENCIAL (um ffmpeg por vez — não fritar a CPU nem competir por
    // I/O; conversão não é hot-path). Cada job casa com o arquivo pelo índice.
    for (let k = 0; k < jobs.length; k++) {
      const job = jobs[k];
      const f = files[k];
      const target = targetById(f.path, f.targetId)!;
      set((s) => ({ jobs: s.jobs.map((j) => (j.id === job.id ? { ...j, status: "running" } : j)) }));
      try {
        await be.ffRun(job.id, target.args(f.path, job.outPath));
        set((s) => ({ jobs: s.jobs.map((j) => (j.id === job.id ? { ...j, status: "done", pct: 100 } : j)) }));
      } catch (e) {
        const msg = String(e);
        const cancelled = /interrompido|killed|cancel/i.test(msg);
        set((s) => ({
          jobs: s.jobs.map((j) =>
            j.id === job.id ? { ...j, status: cancelled ? "cancelled" : "error", error: cancelled ? undefined : msg } : j,
          ),
        }));
      }
    }
    set({ running: false });
  },

  cancel: (jobId) => {
    void be.ffCancel(jobId);
  },

  clearFinished: () => {
    set((s) => ({ jobs: s.jobs.filter((j) => j.status === "waiting" || j.status === "running") }));
  },

  showInFolder: (path) => {
    void revealItemInDir(path).catch(() => {});
  },
}));

// Dev: expõe o store pra smoke no console (fora do Tauri).
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__store = useStore;
}

export { extOf };
