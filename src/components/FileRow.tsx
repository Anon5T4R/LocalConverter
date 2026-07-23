import { t } from "../lib/i18n";
import { targetsFor } from "../lib/formats";
import { useStore, type ConvFile } from "../state/store";

/** Uma linha da lista: nome do arquivo, família, e o seletor de "converter
 *  para". Formato desconhecido (documento, por ora) aparece com aviso honesto. */
export default function FileRow({ file }: { file: ConvFile }) {
  const setTarget = useStore((s) => s.setTarget);
  const removeFile = useStore((s) => s.removeFile);
  const targets = targetsFor(file.path);

  return (
    <div className="file-row">
      <div className="file-icon">{file.kind === "audio" ? "🎵" : file.kind === "image" ? "🖼️" : file.kind === "video" ? "🎬" : "📄"}</div>
      <div className="file-info">
        <div className="file-name" title={file.path}>
          {file.name}
        </div>
        <div className="file-meta">{file.kind ? t(`kind.${file.kind}`) : ""}</div>
      </div>
      {targets && targets.length > 0 ? (
        <label className="convert-to">
          <span className="muted small">{t("card.convertTo")}</span>
          <select value={file.targetId} onChange={(e) => setTarget(file.id, e.target.value)}>
            {targets.map((tg) => (
              <option key={tg.id} value={tg.id}>
                {tg.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span className="muted small unknown-fmt">{t("card.unknown")}</span>
      )}
      <button className="icon-btn" title={t("card.remove")} onClick={() => removeFile(file.id)}>
        ✕
      </button>
    </div>
  );
}
