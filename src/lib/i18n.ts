import { useSyncExternalStore } from "react";

/**
 * i18n leve da UI (padrão da suíte — `docs/planos/padrao-apps.md`). `pt` é a
 * fonte da verdade; `en`/`es` como `Record<MessageKey,string>` forçam completude
 * (o `tsc` recusa chave faltando/sobrando). Locale num store externo pra `t()`
 * rodar fora de componente; o App remonta com `key={locale}` no `main.tsx`.
 */

export type Locale = "pt" | "en" | "es";

export const LOCALE_LABELS: Record<Locale, string> = {
  pt: "Português",
  en: "English",
  es: "Español",
};

const LOCALE_KEY = "localconverter.locale";

const pt = {
  "app.title": "Converta qualquer arquivo",
  "app.sub": "Vídeo, áudio e imagem — arraste pra cá (ou clique). Tudo roda na sua máquina; nenhum arquivo sai do computador.",
  "app.dropHere": "Solte os arquivos aqui",
  "app.dropNothing": "Nenhum arquivo que eu saiba converter nos itens soltos.",
  "topbar.add": "Abrir arquivos",
  "topbar.theme": "Tema",

  "theme.light": "Claro",
  "theme.dark": "Escuro",
  "theme.nature": "Natureza",
  "theme.darkblue": "Azul escuro",
  "theme.calmgreen": "Verde calmo",
  "theme.pastelpink": "Rosa pastel",
  "theme.punkprincess": "PunkPrincess",

  "runtime.missing": "Runtime de mídia ausente (ffmpeg). Em desenvolvimento, rode",

  "kind.video": "vídeo",
  "kind.audio": "áudio",
  "kind.image": "imagem",

  "card.convertTo": "Converter para",
  "card.unknown": "Formato que ainda não sei converter (documentos vêm numa próxima versão).",
  "card.remove": "Remover da lista",

  "convert.all": "Converter {n} arquivo(s)",
  "convert.one": "Converter",
  "convert.sameFolder": "A saída fica ao lado de cada original.",
  "convert.pickFolder": "Escolher pasta de saída…",

  "queue.title": "Fila",
  "queue.waiting": "na fila",
  "queue.running": "convertendo",
  "queue.done": "pronto",
  "queue.error": "erro",
  "queue.cancelled": "cancelado",
  "queue.showInFolder": "Mostrar na pasta",
  "queue.cancel": "Cancelar",
  "queue.clearFinished": "Limpar concluídos",
  "queue.empty": "Nada na fila ainda.",

  "lang.title": "Idioma / Language",
} as const;

export type MessageKey = keyof typeof pt;

const en: Record<MessageKey, string> = {
  "app.title": "Convert any file",
  "app.sub": "Video, audio and image — drag them here (or click). Everything runs on your machine; no file leaves the computer.",
  "app.dropHere": "Drop the files here",
  "app.dropNothing": "No file I know how to convert in the dropped items.",
  "topbar.add": "Open files",
  "topbar.theme": "Theme",

  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.nature": "Nature",
  "theme.darkblue": "Dark blue",
  "theme.calmgreen": "Calm green",
  "theme.pastelpink": "Pastel pink",
  "theme.punkprincess": "PunkPrincess",

  "runtime.missing": "Media runtime missing (ffmpeg). In development, run",

  "kind.video": "video",
  "kind.audio": "audio",
  "kind.image": "image",

  "card.convertTo": "Convert to",
  "card.unknown": "A format I can't convert yet (documents come in a future version).",
  "card.remove": "Remove from the list",

  "convert.all": "Convert {n} file(s)",
  "convert.one": "Convert",
  "convert.sameFolder": "The output goes next to each original.",
  "convert.pickFolder": "Choose output folder…",

  "queue.title": "Queue",
  "queue.waiting": "queued",
  "queue.running": "converting",
  "queue.done": "done",
  "queue.error": "error",
  "queue.cancelled": "cancelled",
  "queue.showInFolder": "Show in folder",
  "queue.cancel": "Cancel",
  "queue.clearFinished": "Clear finished",
  "queue.empty": "Nothing in the queue yet.",

  "lang.title": "Idioma / Language",
};

const es: Record<MessageKey, string> = {
  "app.title": "Convierte cualquier archivo",
  "app.sub": "Vídeo, audio e imagen — arrástralos aquí (o haz clic). Todo corre en tu máquina; ningún archivo sale del ordenador.",
  "app.dropHere": "Suelta los archivos aquí",
  "app.dropNothing": "Ningún archivo que sepa convertir en los elementos soltados.",
  "topbar.add": "Abrir archivos",
  "topbar.theme": "Tema",

  "theme.light": "Claro",
  "theme.dark": "Oscuro",
  "theme.nature": "Naturaleza",
  "theme.darkblue": "Azul oscuro",
  "theme.calmgreen": "Verde tranquilo",
  "theme.pastelpink": "Rosa pastel",
  "theme.punkprincess": "PunkPrincess",

  "runtime.missing": "Falta el runtime de medios (ffmpeg). En desarrollo, ejecuta",

  "kind.video": "vídeo",
  "kind.audio": "audio",
  "kind.image": "imagen",

  "card.convertTo": "Convertir a",
  "card.unknown": "Un formato que aún no sé convertir (los documentos llegan en una versión futura).",
  "card.remove": "Quitar de la lista",

  "convert.all": "Convertir {n} archivo(s)",
  "convert.one": "Convertir",
  "convert.sameFolder": "La salida queda junto a cada original.",
  "convert.pickFolder": "Elegir carpeta de salida…",

  "queue.title": "Cola",
  "queue.waiting": "en cola",
  "queue.running": "convirtiendo",
  "queue.done": "listo",
  "queue.error": "error",
  "queue.cancelled": "cancelado",
  "queue.showInFolder": "Mostrar en la carpeta",
  "queue.cancel": "Cancelar",
  "queue.clearFinished": "Limpiar terminados",
  "queue.empty": "Nada en la cola todavía.",

  "lang.title": "Idioma / Language",
};

const DICTS: Record<Locale, Record<MessageKey, string>> = { pt, en, es };

/* --- store externo do locale (fora do React, pra t() rodar em qualquer lugar) --- */
function initialLocale(): Locale {
  if (typeof localStorage !== "undefined") {
    const s = localStorage.getItem(LOCALE_KEY);
    if (s === "pt" || s === "en" || s === "es") return s;
  }
  return "pt";
}
let locale: Locale = initialLocale();
const listeners = new Set<() => void>();

export function setLocale(next: Locale): void {
  if (next === locale) return;
  locale = next;
  if (typeof localStorage !== "undefined") localStorage.setItem(LOCALE_KEY, next);
  listeners.forEach((l) => l());
}
export function getLocale(): Locale {
  return locale;
}
export function useLocale(): Locale {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => locale,
  );
}

/** Traduz uma chave, com interpolação `{nome}`. */
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  let s = DICTS[locale][key] ?? pt[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
  return s;
}
