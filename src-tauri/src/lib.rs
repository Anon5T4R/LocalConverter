mod ffmpeg;
mod pandoc;

use tauri::Manager;

/// Contorna a titlebar quebrada do tao <= 0.35 no GNOME/Wayland (CSD propia
/// com regiao de input morta — causa e fix em tao#1218, so via tauri 2.12):
/// troca por uma HeaderBar comum com layout forcado min/max/fechar, ANTES do
/// primeiro map. Sai junto com o upgrade ao tao 0.36 (wry 0.56).
#[cfg(target_os = "linux")]
fn instalar_csd_limpa(w: &tauri::WebviewWindow) {
    use gtk::prelude::*;
    let Ok(gw) = w.gtk_window() else { return };
    let header = gtk::HeaderBar::new();
    header.set_show_close_button(true);
    header.set_decoration_layout(Some("menu:minimize,maximize,close"));
    header.set_title(Some("LocalConverter"));
    header.show();
    gw.set_titlebar(Some(&header));
}

fn open_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // ── Contorno da tela branca do webkit: REMOVIDO, e o porquê importa ──────
    //
    // Este bloco desligava o renderer DMABUF, desligava o compositing e forçava
    // XWayland, porque o webkit2gtk pintava a janela inteira de branco em
    // Arch/GNOME. Era mitigação às cegas — o comentário dizia "branco é pior que
    // lento" — e custava a aceleração do WebView.
    //
    // A CAUSA foi encontrada em 26/07/2026 e é de EMPACOTAMENTO, não de código:
    // o AppDir do AppImage levava `libwayland-*` do Ubuntu do CI, que brigavam
    // com o Mesa do host e derrubavam o EGL (`EGL_BAD_PARAMETER`). Corrigido em
    // `Anon5T4R/linux-packaging`: as libs que falam com driver/compositor agora
    // vêm do host, e o pacote nativo (pacman/apt) usa o webkit do sistema.
    // Tratar o sintoma deixou de fazer sentido.
    //
    // Remover o forçamento NÃO tira a saída de emergência: estas variáveis são
    // lidas pelo próprio webkitgtk, não por este código. Se a tela branca voltar
    // em alguma combinação de driver, rodar com
    // `WEBKIT_DISABLE_DMABUF_RENDERER=1` continua funcionando — e aí é sinal de
    // que sobrou lib de host em algum AppDir, que é onde se deve olhar.

    tauri::Builder::default()
        .setup(|app| {
            // Titlebar limpa no GNOME/Wayland (tao <= 0.35) — ver lib.rs do LocalImage.
            #[cfg(target_os = "linux")]
            if let Some(w) = app.get_webview_window("main") {
                instalar_csd_limpa(&w);
            }
            Ok(())
        })
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            open_main(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(ffmpeg::FfState::default())
        .invoke_handler(tauri::generate_handler![
            ffmpeg::ffmpeg_ok,
            ffmpeg::media_probe,
            ffmpeg::ff_run,
            ffmpeg::ff_cancel,
            ffmpeg::unique_path,
            pandoc::pandoc_ok,
            pandoc::pandoc_run,
            pandoc::pandoc_pdf
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Garante que nenhum ffmpeg fica órfão quando o app sai.
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = app_handle.try_state::<ffmpeg::FfState>() {
                    ffmpeg::kill_all(&state);
                }
            }
        });
}
