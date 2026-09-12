//! Resolução de `.acsm` (Adobe Content Server Message) via libgourou embarcado
//! (binaries/libgourou).
//!
//! O `.acsm` não é o ebook — é o token de licença. O fluxo abaixo segue a
//! referência do libgourou v0.8.10 (utils CLI):
//!   1. `adept_activate -a --output-dir <adept>` — ativação ANÔNIMA (sem Adobe
//!      ID), só na primeira vez; o estado fica em `<app_data>/adept`.
//!   2. `acsmdownloader --adept-directory <adept> <input>` — troca o token nos
//!      servidores da Adobe e baixa o EPUB/PDF (ainda com DRM ADEPT) ao lado do
//!      `.acsm` (por isso o cwd = pasta do input).
//!   3. `adept_remove --output-file <final> <baixado>` — remove o ADEPT → arquivo
//!      legível.
//!
//! Flags CONFERIDAS na fonte (utils/*.cpp do libgourou v0.8.10, 2026-09-11):
//!   - `adept_activate -a -r --output-dir <dir>` — anônimo; a pasta de saída
//!     PRECISA não existir (senão abre prompt interativo — com stdin fechado,
//!     trava). O pai é criado; o `adept` em si, não.
//!   - `acsmdownloader --adept-directory <dir> <input>` — grava ao lado do input
//!     (cwd), no nome do título + `.epub`/`.pdf`.
//!   - `adept_remove --adept-directory <dir> --output-file <final> <baixado>`.
//!
//! Mesma pegada do pandoc/ffmpeg deste app: RESOURCE (não sidecar), rodado por
//! `std::process::Command`. Passos 1–2 exigem internet (fulfillment); o 3 é local.
//!
//! Painel de device (Adobe ACSM): `acsm_device_status` (estado atual),
//! `acsm_import_activation` (importa uma ativação exportada do ADE/Calibre),
//! `acsm_login_adobe` (ativa com Adobe ID via `adept_activate -u/-p`) e
//! `acsm_reset_device` (apaga a ativação atual).

use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};

use tauri::Manager;

const ACTIVATE_BIN: &str = if cfg!(windows) { "adept_activate.exe" } else { "adept_activate" };
const DOWNLOAD_BIN: &str = if cfg!(windows) { "acsmdownloader.exe" } else { "acsmdownloader" };
const REMOVE_BIN: &str = if cfg!(windows) { "adept_remove.exe" } else { "adept_remove" };

fn no_window(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    let _ = cmd;
}

/// Localiza a PASTA `binaries/<sub>` (dev: cwd; prod: resource dir / ao lado do
/// exe), nos mesmos candidatos do `resolve_bin` do pandoc.
fn resolve_dir(app: &tauri::AppHandle, sub: &str) -> Result<PathBuf, String> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("binaries").join(sub));
        candidates.push(cwd.join(sub));
    }
    if let Ok(res) = app.path().resource_dir() {
        candidates.push(res.join("binaries").join(sub));
        candidates.push(res.join(sub));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("binaries").join(sub));
            candidates.push(dir.join(sub));
        }
    }
    for c in candidates {
        if c.is_dir() {
            return Ok(c);
        }
    }
    Err("libgourou não encontrado (runtime ausente)".into())
}

/// Os 3 utils do libgourou estão presentes? (a UI degrada sem eles)
#[tauri::command(async)]
pub fn acsm_ok(app: tauri::AppHandle) -> bool {
    let Ok(dir) = resolve_dir(&app, "libgourou") else { return false };
    dir.join(ACTIVATE_BIN).exists()
        && dir.join(DOWNLOAD_BIN).exists()
        && dir.join(REMOVE_BIN).exists()
}

/// Roda um util do libgourou: stdin/stdout nulos, stderr capturado, sem janela
/// de console. Erro = stderr do processo (mensagem útil pro usuário).
fn run(bin: &Path, args: &[String], cwd: Option<&Path>) -> Result<Output, String> {
    let mut cmd = Command::new(bin);
    cmd.args(args)
        .stdin(Stdio::null())
        // Os utils do libgourou imprimem o erro no STDOUT (std::cout), nao no
        // stderr — capturamos os dois.
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    // O ADEPT precisa do provider "legacy" do OpenSSL (cripto antiga). O
    // legacy.dll vai ao lado dos utils; apontamos o OPENSSL_MODULES pra la.
    // O libcurl (OpenSSL) tambem precisa do CA bundle — que vai ao lado.
    if let Some(dir) = bin.parent() {
        cmd.env("OPENSSL_MODULES", dir);
        let ca = dir.join("ca-bundle.crt");
        if ca.exists() {
            cmd.env("CURL_CA_BUNDLE", &ca);
            cmd.env("SSL_CERT_FILE", &ca);
        }
    }
    no_window(&mut cmd);

    let out = cmd.output().map_err(|e| format!("falha ao rodar {}: {}", bin.display(), e))?;
    if !out.status.success() {
        let so = String::from_utf8_lossy(&out.stdout);
        let se = String::from_utf8_lossy(&out.stderr);
        let msg = format!("{}\n{}", so.trim(), se.trim());
        let msg = msg.trim();
        return Err(if msg.is_empty() { format!("{} falhou", bin.display()) } else { msg.to_string() });
    }
    Ok(out)
}

/// `.epub`/`.pdf` mais recente em `dir` com mtime >= `after` — o download do
/// `acsmdownloader` cai ao lado do `.acsm`; o `after` (capturado antes do
/// download) evita pegar arquivo antigo da pasta.
fn newest_after(dir: &Path, after: std::time::SystemTime) -> Option<PathBuf> {
    let mut best: Option<(std::time::SystemTime, PathBuf)> = None;
    for entry in std::fs::read_dir(dir).ok()?.flatten() {
        let path = entry.path();
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
        if ext != "epub" && ext != "pdf" {
            continue;
        }
        let Ok(meta) = entry.metadata() else { continue };
        if !meta.is_file() {
            continue;
        }
        let Ok(mtime) = meta.modified() else { continue };
        if mtime < after {
            continue;
        }
        if best.as_ref().map(|(t, _)| mtime > *t).unwrap_or(true) {
            best = Some((mtime, path));
        }
    }
    best.map(|(_, p)| p)
}

/// Caminho livre: acrescenta " (n)" antes da extensão até não colidir (mesma
/// regra do `ffmpeg::unique_path`).
fn unique_path(path: &str) -> String {
    let p = Path::new(path);
    if !p.exists() {
        return path.to_string();
    }
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("saida");
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("");
    let dir = p.parent().map(|d| d.to_path_buf()).unwrap_or_default();
    for n in 1..1000 {
        let name =
            if ext.is_empty() { format!("{} ({})", stem, n) } else { format!("{} ({}).{}", stem, n, ext) };
        let candidate = dir.join(name);
        if !candidate.exists() {
            return candidate.to_string_lossy().to_string();
        }
    }
    path.to_string()
}

/// Resolve um `.acsm` → EPUB/PDF legível: ativa (anônimo, 1ª vez) → baixa →
/// remove o ADEPT. `input` = caminho do `.acsm`; `out_base` = caminho final SEM
/// extensão (a extensão natural `.epub`/`.pdf` vem do arquivo baixado). Retorna
/// o caminho final gravado.
#[tauri::command(async)]
pub fn acsm_run(app: tauri::AppHandle, input: String, out_base: String) -> Result<String, String> {
    let dir = resolve_dir(&app, "libgourou")?;
    let activate = dir.join(ACTIVATE_BIN);
    let download = dir.join(DOWNLOAD_BIN);
    let remove = dir.join(REMOVE_BIN);

    let adept_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("sem diretório de dados do app: {}", e))?
        .join("adept");

    // `adept_activate` EXIGE que a pasta de saída NÃO exista (senão abre um
    // prompt interativo e, com stdin fechado, trava). Criamos o PAI, não o
    // `adept`.
    if let Some(parent) = adept_dir.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("falha ao criar {}: {}", parent.display(), e))?;
    }

    // Ativação anônima (sem conta) — só na primeira vez. `-a` = anonymous,
    // `-r` = serial aleatório (evita device id preso à máquina).
    if !adept_dir.join("activation.xml").exists() {
        if adept_dir.exists() {
            // Estado parcial (pasta sem activation.xml): limpa antes de ativar.
            std::fs::remove_dir_all(&adept_dir)
                .map_err(|e| format!("falha ao limpar {}: {}", adept_dir.display(), e))?;
        }
        run(
            &activate,
            &[
                "-a".to_string(),
                "-r".to_string(),
                "--output-dir".to_string(),
                adept_dir.to_string_lossy().to_string(),
            ],
            None,
        )?;
    }

    let input_path = PathBuf::from(&input);
    let input_dir = input_path.parent().filter(|p| !p.as_os_str().is_empty());
    let before = std::time::SystemTime::now();
    run(
        &download,
        &["--adept-directory".to_string(), adept_dir.to_string_lossy().to_string(), input],
        input_dir,
    )?;

    let scan_dir = input_dir.unwrap_or(Path::new("."));
    let downloaded = newest_after(scan_dir, before)
        .ok_or("download não produziu .epub/.pdf ao lado do .acsm")?;

    let ext = downloaded
        .extension()
        .and_then(|e| e.to_str())
        .ok_or("arquivo baixado sem extensão .epub/.pdf")?;
    let final_path = unique_path(&format!("{}.{}", out_base, ext));

    run(
        &remove,
        &[
            "--adept-directory".to_string(),
            adept_dir.to_string_lossy().to_string(),
            "--output-file".to_string(),
            final_path.clone(),
            downloaded.to_string_lossy().to_string(),
        ],
        None,
    )?;

    Ok(final_path)
}

/// Estado do device Adobe (ACSM): ativado? e, se sim, o serial do `device.xml`.
#[derive(serde::Serialize)]
pub struct AcsmDevice {
    pub activated: bool,
    pub serial: Option<String>,
}

/// Pasta `<app_data>/adept` (estado da ativação do libgourou).
fn adept_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join("adept"))
        .map_err(|e| format!("sem diretório de dados do app: {}", e))
}

/// Lê o serial entre `<adept:deviceSerial>` e `</adept:deviceSerial>` do
/// `device.xml` (busca simples de string; ausente → `None`).
fn device_serial(device_xml: &Path) -> Option<String> {
    let content = std::fs::read_to_string(device_xml).ok()?;
    let open = "<adept:deviceSerial>";
    let close = "</adept:deviceSerial>";
    let start = content.find(open)? + open.len();
    let end = content[start..].find(close)? + start;
    let serial = content[start..end].trim();
    if serial.is_empty() {
        None
    } else {
        Some(serial.to_string())
    }
}

/// Status do device: `activated` = existe `device.xml`; `serial` = o serial
/// extraído (se o arquivo existir mas o serial não for achado, `None`).
#[tauri::command(async)]
pub fn acsm_device_status(app: tauri::AppHandle) -> Result<AcsmDevice, String> {
    let dir = adept_dir(&app)?;
    let device_xml = dir.join("device.xml");
    if !device_xml.exists() {
        return Ok(AcsmDevice { activated: false, serial: None });
    }
    Ok(AcsmDevice { activated: true, serial: device_serial(&device_xml) })
}

/// Importa uma ativação existente do ADE/Calibre: copia `device.xml`,
/// `activation.xml` e `devicesalt` de `dir` para `<app_data>/adept`.
#[tauri::command(async)]
pub fn acsm_import_activation(app: tauri::AppHandle, dir: String) -> Result<(), String> {
    let src = PathBuf::from(&dir);
    let files = ["device.xml", "activation.xml", "devicesalt"];
    let mut missing: Vec<&str> = Vec::new();
    for f in files {
        if !src.join(f).exists() {
            missing.push(f);
        }
    }
    if !missing.is_empty() {
        return Err(format!("pasta sem os arquivos de ativação: {}", missing.join(", ")));
    }

    let adept = adept_dir(&app)?;
    if adept.exists() {
        std::fs::remove_dir_all(&adept)
            .map_err(|e| format!("falha ao limpar {}: {}", adept.display(), e))?;
    }
    std::fs::create_dir_all(&adept)
        .map_err(|e| format!("falha ao criar {}: {}", adept.display(), e))?;

    for f in files {
        std::fs::copy(src.join(f), adept.join(f))
            .map_err(|e| format!("falha ao copiar {}: {}", f, e))?;
    }
    Ok(())
}

/// Ativa um device com Adobe ID via `adept_activate -u <user> -p <password>`.
/// A senha vai como argumento de processo (visível no gerenciador de tarefas por
/// instantes) — é a única via do libgourou (não lê stdin).
#[tauri::command(async)]
pub fn acsm_login_adobe(app: tauri::AppHandle, user: String, password: String) -> Result<(), String> {
    let dir = resolve_dir(&app, "libgourou")?;
    let activate = dir.join(ACTIVATE_BIN);

    let adept = adept_dir(&app)?;
    // `adept_activate` EXIGE que a pasta de saída NÃO exista (senão abre prompt
    // interativo e, com stdin fechado, trava). Criamos o PAI, não o `adept`.
    if adept.exists() {
        std::fs::remove_dir_all(&adept)
            .map_err(|e| format!("falha ao limpar {}: {}", adept.display(), e))?;
    }
    if let Some(parent) = adept.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("falha ao criar {}: {}", parent.display(), e))?;
    }

    run(
        &activate,
        &[
            "-u".to_string(),
            user,
            "-p".to_string(),
            password,
            "--output-dir".to_string(),
            adept.to_string_lossy().to_string(),
        ],
        None,
    )?;
    Ok(())
}

/// Apaga a ativação atual (`<app_data>/adept`); a próxima conversão cria uma nova.
#[tauri::command(async)]
pub fn acsm_reset_device(app: tauri::AppHandle) -> Result<(), String> {
    let adept = adept_dir(&app)?;
    if adept.exists() {
        std::fs::remove_dir_all(&adept)
            .map_err(|e| format!("falha ao limpar {}: {}", adept.display(), e))?;
    }
    Ok(())
}