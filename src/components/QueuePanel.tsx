import { t, type MessageKey } from "../lib/i18n";
import { useStore, type JobStatus } from "../state/store";

const STATUS_KEY: Record<JobStatus, MessageKey> = {
  waiting: "queue.waiting",
  running: "queue.running",
  done: "queue.done",
  error: "queue.error",
  cancelled: "queue.cancelled",
};

export default function QueuePanel() {
  const jobs = useStore((s) => s.jobs);
  const cancel = useStore((s) => s.cancel);
  const clearFinished = useStore((s) => s.clearFinished);
  const showInFolder = useStore((s) => s.showInFolder);

  const hasFinished = jobs.some((j) => j.status === "done" || j.status === "error" || j.status === "cancelled");

  return (
    <section className="queue">
      <div className="queue-head">
        <h2>{t("queue.title")}</h2>
        {hasFinished && (
          <button className="btn ghost small" onClick={clearFinished}>
            {t("queue.clearFinished")}
          </button>
        )}
      </div>
      <div className="queue-list">
        {jobs.map((j) => (
          <div key={j.id} className={`queue-item ${j.status}`}>
            <div className="queue-info">
              <div className="queue-name">
                {j.fileName} <span className="muted">→ {j.targetLabel}</span>
              </div>
              <div className="queue-status">
                {t(STATUS_KEY[j.status])}
                {j.status === "running" && j.pct > 0 ? ` · ${j.pct}%` : ""}
                {j.speed && j.status === "running" ? ` · ${j.speed}` : ""}
                {j.error ? <span className="queue-err"> — {j.error}</span> : null}
              </div>
              {j.status === "running" && (
                <div className="pbar">
                  <div className="pbar-fill" style={{ width: `${j.pct}%` }} />
                </div>
              )}
            </div>
            <div className="queue-actions">
              {j.status === "running" && (
                <button className="btn ghost small" onClick={() => cancel(j.id)}>
                  {t("queue.cancel")}
                </button>
              )}
              {j.status === "done" && (
                <button className="btn small" onClick={() => showInFolder(j.outPath)}>
                  {t("queue.showInFolder")}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
