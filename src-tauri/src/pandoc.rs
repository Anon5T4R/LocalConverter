//! Conversão de DOCUMENTOS via pandoc embarcado (binaries/pandoc).
//!
//! Mesma pegada do ffmpeg deste app: o pandoc é um RESOURCE (não sidecar),
//! rodado por `std::process::Command`. O front decide `from`/`to` (writer do
//! pandoc) em `src/lib/formats.ts`; aqui só resolvemos o binário e executamos.
//! pandoc infere o formato de ENTRADA pela extensão; o de SAÍDA vem explícito
//! (`-t`), que é o que a matriz de formatos escolhe.

use std::path::PathBuf;
use std::process::{Command, Stdio};

use tauri::Manager;

const PANDOC_BIN: &str = if cfg!(windows) { "pandoc.exe" } else { "pandoc" };
const TYPST_BIN: &str = if cfg!(windows) { "typst.exe" } else { "typst" };

fn no_window(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    let _ = cmd;
}

/// Localiza um binário embarcado em `binaries/<sub>/<bin>`. Dev: cwd. Prod:
/// resource dir / ao lado do exe. Genérico pro pandoc E pro typst.
fn resolve_bin(app: &tauri::AppHandle, sub: &str, bin: &str, human: &str) -> Result<PathBuf, String> {
    let rel = format!("binaries/{}/{}", sub, bin);
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join(&rel));
    }
    if let Ok(res) = app.path().resource_dir() {
        candidates.push(res.join(&rel));
        candidates.push(res.join(format!("{}/{}", sub, bin)));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join(&rel));
            candidates.push(dir.join(format!("{}/{}", sub, bin)));
        }
    }
    for c in candidates {
        if c.exists() {
            return Ok(c);
        }
    }
    Err(format!("{} não encontrado (runtime ausente)", human))
}

fn resolve(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    resolve_bin(app, "pandoc", PANDOC_BIN, "pandoc")
}

/// O pandoc está presente? (a UI decide se oferece conversão de documento)
#[tauri::command(async)]
pub fn pandoc_ok(app: tauri::AppHandle) -> bool {
    resolve(&app).is_ok()
}

/// Converte `input` → `output` com pandoc. `to` é o writer (`-t`), escolhido
/// pela matriz de formatos; a entrada é inferida pela extensão. Erro volta com
/// o stderr do pandoc (mensagem útil pro usuário — a UI mostra).
#[tauri::command(async)]
pub fn pandoc_run(
    app: tauri::AppHandle,
    input: String,
    output: String,
    to: String,
) -> Result<(), String> {
    let bin = resolve(&app)?;
    let mut cmd = Command::new(&bin);
    cmd.arg(&input)
        .args(["-t", &to, "-o", &output])
        // Documento auto-contido: imagens embutidas viram data URI em vez de
        // apontar pra um caminho que não existe fora do arquivo de origem.
        .arg("--embed-resources")
        .arg("--standalone")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    no_window(&mut cmd);

    let out = cmd.output().map_err(|e| format!("falha ao rodar pandoc: {}", e))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        let msg = err.trim();
        return Err(if msg.is_empty() { "pandoc falhou".into() } else { msg.to_string() });
    }
    Ok(())
}

/// Converte um documento → **PDF** via pandoc usando o **typst** como motor
/// (`--pdf-engine`). Typst é um binário único (sem LaTeX): não trava calado, é
/// determinístico. É o caminho `docx→pdf` da suíte, sem os ~600MB do LaTeX.
#[tauri::command(async)]
pub fn pandoc_pdf(app: tauri::AppHandle, input: String, output: String) -> Result<(), String> {
    let pandoc = resolve(&app)?;
    let typst = resolve_bin(&app, "typst", TYPST_BIN, "typst")?;
    let engine = format!("--pdf-engine={}", typst.to_string_lossy());
    let mut cmd = Command::new(&pandoc);
    // Entrada inferida pela extensão; saída PDF pelo `-o *.pdf` + o motor typst.
    cmd.arg(&input)
        .arg(&engine)
        .args(["-o", &output])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped());
    no_window(&mut cmd);

    let out = cmd.output().map_err(|e| format!("falha ao rodar pandoc: {}", e))?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        let msg = err.trim();
        return Err(if msg.is_empty() { "pandoc/typst falhou".into() } else { msg.to_string() });
    }
    Ok(())
}
