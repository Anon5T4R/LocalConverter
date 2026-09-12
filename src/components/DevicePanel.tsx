import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";

import * as be from "../lib/backend";
import { t } from "../lib/i18n";

/** Painel do device Adobe (ACSM): status, importar ativação do ADE, login
 *  Adobe ID e resetar. O backend orquestra o libgourou (ver `acsm.rs`).
 *
 *  O device é o que autoriza o fulfillment de um `.acsm`. O padrão é anônimo
 *  (sem login); aqui o usuário pode reusar uma ativação que já tem (ADE) ou
 *  entrar com Adobe ID — útil quando o provedor (ex.: Google Play) impõe
 *  limite de dispositivos. */
export default function DevicePanel({ onClose }: { onClose: () => void }) {
  const [device, setDevice] = useState<be.AcsmDevice | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");

  const refresh = useCallback(async () => {
    try {
      setDevice(await be.acsmDeviceStatus());
    } catch (e) {
      setErr(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await fn();
      await refresh();
      setMsg(t("device.done"));
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function importAde() {
    const dir = await open({ directory: true }).catch(() => null);
    if (!dir || Array.isArray(dir)) return;
    await run(() => be.acsmImportActivation(dir));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal device-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{t("device.title")}</h2>
          <button className="btn ghost small" onClick={onClose}>
            {t("device.close")}
          </button>
        </div>

        <div className="device-status">
          {device?.activated ? (
            <>
              <span className="chip">{t("device.statusOn")}</span>
              {device.serial && (
                <span className="muted small">
                  {t("device.serial")}: {device.serial}
                </span>
              )}
            </>
          ) : (
            <span className="chip">{t("device.statusOff")}</span>
          )}
        </div>

        <section className="device-section">
          <button className="btn" disabled={busy} onClick={() => void importAde()}>
            {t("device.import")}
          </button>
          <p className="card-hint">{t("device.importHint")}</p>
        </section>

        <section className="device-section">
          <div className="device-login">
            <input
              type="email"
              placeholder={t("device.loginUser")}
              value={user}
              onChange={(e) => setUser(e.target.value)}
              disabled={busy}
            />
            <input
              type="password"
              placeholder={t("device.loginPass")}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              disabled={busy}
            />
            <button
              className="btn primary"
              disabled={busy || !user || !pass}
              onClick={() => void run(() => be.acsmLoginAdobe(user, pass))}
            >
              {t("device.login")}
            </button>
          </div>
          <p className="card-hint">{t("device.loginHint")}</p>
        </section>

        <section className="device-section">
          <button className="btn danger" disabled={busy} onClick={() => void run(() => be.acsmResetDevice())}>
            {t("device.reset")}
          </button>
          <p className="card-hint">{t("device.resetHint")}</p>
        </section>

        {busy && <p className="muted small">{t("device.working")}</p>}
        {msg && <p className="muted small">{msg}</p>}
        {err && (
          <p className="device-err">
            {t("device.error")}: {err}
          </p>
        )}
      </div>
    </div>
  );
}
