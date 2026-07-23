import { useEffect, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";

import { inTauri } from "./lib/backend";
import { ALL_INPUT_EXT, extOf } from "./lib/formats";
import { LOCALE_LABELS, type Locale, setLocale, t, useLocale } from "./lib/i18n";
import { applyTheme, loadTheme, THEME_LABEL_KEYS, THEMES, type Theme } from "./lib/theme";
import FileRow from "./components/FileRow";
import QueuePanel from "./components/QueuePanel";
import { useStore } from "./state/store";

const LOCALES: Locale[] = ["pt", "en", "es"];

export default function App() {
  const files = useStore((s) => s.files);
  const jobs = useStore((s) => s.jobs);
  const running = useStore((s) => s.running);
  const runtimeOk = useStore((s) => s.runtimeOk);
  const init = useStore((s) => s.init);
  const addPaths = useStore((s) => s.addPaths);
  const convertAll = useStore((s) => s.convertAll);
  const locale = useLocale();
  const [theme, setTheme] = useState<Theme>(loadTheme);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Arrastar arquivos pra janela (evento nativo do Tauri).
  useEffect(() => {
    if (!inTauri()) return;
    let unlisten: (() => void) | undefined;
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "over") return;
        if (event.payload.type === "enter") setDragging(true);
        else if (event.payload.type === "leave") setDragging(false);
        else if (event.payload.type === "drop") {
          setDragging(false);
          const paths = (event.payload.paths ?? []).filter((p) => ALL_INPUT_EXT.includes(extOf(p)));
          if (paths.length > 0) void addPaths(paths);
        }
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  }, [addPaths]);

  async function pickFiles() {
    const picked = await open({
      multiple: true,
      filters: [{ name: "LocalConverter", extensions: ALL_INPUT_EXT }],
    }).catch(() => null);
    if (!picked) return;
    void addPaths(Array.isArray(picked) ? picked : [picked]);
  }

  const convertible = files.filter((f) => f.kind && f.targetId).length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">⇄</span>
          <span className="brand-name">LocalConverter</span>
        </div>
        <div className="topbar-actions">
          <button className="btn primary" onClick={() => void pickFiles()}>
            + {t("topbar.add")}
          </button>
          <select
            className="theme-select"
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
            title={t("topbar.theme")}
          >
            {THEMES.map((th) => (
              <option key={th} value={th}>
                {t(THEME_LABEL_KEYS[th])}
              </option>
            ))}
          </select>
          <select
            className="lang-select"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            title={t("lang.title")}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_LABELS[l]}
              </option>
            ))}
          </select>
        </div>
      </header>

      <main className="main">
        {!runtimeOk && (
          <div className="banner warn">
            {t("runtime.missing")} <code>scripts/fetch-ffmpeg</code>.
          </div>
        )}

        {files.length === 0 ? (
          <div className="empty-hero" onClick={() => void pickFiles()}>
            <div className="drop-icon">⇄</div>
            <h1>{t("app.title")}</h1>
            <p className="home-sub">{t("app.sub")}</p>
          </div>
        ) : (
          <>
            <div className="file-list">
              {files.map((f) => (
                <FileRow key={f.id} file={f} />
              ))}
              <div className="add-row" onClick={() => void pickFiles()}>
                <span className="drop-icon">＋</span>
              </div>
            </div>
            {convertible > 0 && (
              <div className="convert-bar">
                <span className="muted small">{t("convert.sameFolder")}</span>
                <button
                  className="btn primary"
                  disabled={running}
                  onClick={() => void convertAll()}
                >
                  {t("convert.all", { n: convertible })}
                </button>
              </div>
            )}
          </>
        )}

        {jobs.length > 0 && <QueuePanel />}
      </main>

      {dragging && (
        <div className="drop-overlay">
          <div className="drop-overlay-inner">{t("app.dropHere")}</div>
        </div>
      )}
    </div>
  );
}
