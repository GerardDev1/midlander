//! Midlander's desktop shell: window, native menus and file access.
//!
//! The screenplay model, .fadein parsing and pagination all live in the
//! TypeScript packages. This side only does what a webview can't: native
//! menus, the Open dialog, and reading files from disk.
//!
//! Every menu item here does something. Items for features that aren't built
//! yet are left out rather than shown disabled or as placeholders.

use std::io::Read;
use std::path::Path;

use serde::Serialize;
use tauri::menu::{AboutMetadataBuilder, Menu, MenuBuilder, MenuItem, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, State, Wry};
use tauri_plugin_dialog::DialogExt;

/// Largest script file Midlander will try to open (a feature-length .fadein is well under 1 MB).
const MAX_FILE_BYTES: u64 = 64 * 1024 * 1024;

/// The File > Close item, kept so it can be enabled only while a script is open.
struct CloseItem(MenuItem<Wry>);

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct RawScript {
    /// File name shown in the window title, e.g. "My Script.fadein".
    name: String,
    /// The Open Screenplay Format XML inside the .fadein file.
    xml: String,
}

/// Reads a .fadein file (a zip archive) and returns the screenplay XML inside it.
pub fn read_fadein(path: &Path) -> Result<RawScript, String> {
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Untitled".into());
    let fail = |why: &str| format!("{name} couldn't be opened: {why}");

    let meta = std::fs::metadata(path).map_err(|e| fail(&e.to_string()))?;
    if meta.len() > MAX_FILE_BYTES {
        return Err(fail("the file is too large to be a screenplay."));
    }
    let file = std::fs::File::open(path).map_err(|e| fail(&e.to_string()))?;
    let mut archive =
        zip::ZipArchive::new(file).map_err(|_| fail("it isn't a Fade In (.fadein) file, or it is damaged."))?;

    let entry_name = {
        let names: Vec<String> = archive.file_names().map(String::from).collect();
        names
            .iter()
            .find(|n| n.as_str() == "document.xml")
            .or_else(|| names.iter().find(|n| n.ends_with(".xml")))
            .cloned()
            .ok_or_else(|| fail("there is no screenplay inside the file."))?
    };
    let mut entry = archive.by_name(&entry_name).map_err(|e| fail(&e.to_string()))?;
    if entry.size() > MAX_FILE_BYTES {
        return Err(fail("the screenplay inside is too large."));
    }
    let mut xml = String::new();
    entry
        .read_to_string(&mut xml)
        .map_err(|_| fail("the screenplay inside couldn't be read as text."))?;
    Ok(RawScript { name, xml })
}

fn is_fadein(path: &Path) -> bool {
    path.extension().map(|e| e.eq_ignore_ascii_case("fadein")).unwrap_or(false)
}

fn show_open_dialog(app: &AppHandle) {
    let handle = app.clone();
    let mut dialog = app.dialog().file().add_filter("Fade In script", &["fadein"]);
    if let Some(window) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&window);
    }
    dialog.pick_file(move |picked| {
        let Some(picked) = picked else { return }; // cancelled
        let result = picked
            .into_path()
            .map_err(|e| format!("That file couldn't be opened: {e}"))
            .and_then(|p| read_fadein(&p));
        let _ = match result {
            Ok(script) => handle.emit("script-opened", script),
            Err(message) => handle.emit("script-open-failed", message),
        };
    });
}

#[tauri::command]
fn open_script(app: AppHandle) {
    show_open_dialog(&app);
}

/// Used when a file is dragged onto the window.
#[tauri::command]
fn load_script(path: String) -> Result<RawScript, String> {
    let path = Path::new(&path);
    if !is_fadein(path) {
        return Err("Midlander can open Fade In scripts (.fadein) so far.".into());
    }
    read_fadein(path)
}

#[tauri::command]
fn set_document_open(open: bool, close: State<'_, CloseItem>) -> Result<(), String> {
    close.0.set_enabled(open).map_err(|e| e.to_string())
}

fn build_menu(app: &AppHandle) -> tauri::Result<(Menu<Wry>, MenuItem<Wry>)> {
    let about = AboutMetadataBuilder::new()
        .name(Some("Midlander"))
        .version(Some(app.package_info().version.to_string()))
        .comments(Some("A desktop screenwriting application."))
        .build();

    let open = MenuItemBuilder::with_id("open", "Open…").accelerator("CmdOrCtrl+O").build(app)?;
    let close = MenuItemBuilder::with_id("close", "Close")
        .accelerator("CmdOrCtrl+W")
        .enabled(false)
        .build(app)?;

    let mut file = SubmenuBuilder::new(app, "File").item(&open).separator().item(&close);
    if !cfg!(target_os = "macos") {
        file = file.separator().quit_with_text("Exit");
    }

    // The page view is read-only so far: only Copy and Select All do anything.
    let edit = SubmenuBuilder::new(app, "Edit").copy().select_all();

    let view = SubmenuBuilder::new(app, "View")
        .item(&MenuItemBuilder::with_id("zoom-in", "Zoom In").accelerator("CmdOrCtrl+=").build(app)?)
        .item(&MenuItemBuilder::with_id("zoom-out", "Zoom Out").accelerator("CmdOrCtrl+-").build(app)?)
        .item(
            &MenuItemBuilder::with_id("zoom-reset", "Zoom 100%")
                .accelerator("Alt+Shift+CmdOrCtrl+0")
                .build(app)?,
        );

    let mut menu = MenuBuilder::new(app);
    if cfg!(target_os = "macos") {
        let app_menu = SubmenuBuilder::new(app, "Midlander")
            .about(Some(about.clone()))
            .separator()
            .services()
            .separator()
            .hide()
            .hide_others()
            .show_all()
            .separator()
            .quit()
            .build()?;
        menu = menu.item(&app_menu);
    }
    menu = menu.item(&file.build()?).item(&edit.build()?).item(&view.build()?);
    if cfg!(target_os = "macos") {
        // Full screen is left out: Fade In uses Option+Enter for it, and the
        // full-screen modes are built with the interface (Phase 4).
        let window = SubmenuBuilder::new(app, "Window").minimize().maximize().build()?;
        menu = menu.item(&window);
    } else {
        let help = SubmenuBuilder::new(app, "Help").about(Some(about)).build()?;
        menu = menu.item(&help);
    }
    Ok((menu.build()?, close))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let (menu, close) = build_menu(app.handle())?;
            app.set_menu(menu)?;
            app.manage(CloseItem(close));
            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_open_dialog(app),
            id @ ("close" | "zoom-in" | "zoom-out" | "zoom-reset") => {
                let _ = app.emit("menu", id);
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![open_script, load_script, set_document_open])
        .run(tauri::generate_context!())
        .expect("error while running Midlander");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    fn temp_file(name: &str, bytes: &[u8]) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("midlander-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(name);
        std::fs::write(&path, bytes).unwrap();
        path
    }

    fn zip_with(entries: &[(&str, &str)]) -> Vec<u8> {
        let mut buf = std::io::Cursor::new(Vec::new());
        {
            let mut w = zip::ZipWriter::new(&mut buf);
            for (name, body) in entries {
                let opts = zip::write::SimpleFileOptions::default()
                    .compression_method(zip::CompressionMethod::Deflated);
                w.start_file(*name, opts).unwrap();
                w.write_all(body.as_bytes()).unwrap();
            }
            w.finish().unwrap();
        }
        buf.into_inner()
    }

    #[test]
    fn reads_document_xml_from_a_fadein_zip() {
        let path = temp_file("Pier.fadein", &zip_with(&[("other.txt", "x"), ("document.xml", "<document/>")]));
        let script = read_fadein(&path).unwrap();
        assert_eq!(script, RawScript { name: "Pier.fadein".into(), xml: "<document/>".into() });
    }

    #[test]
    fn falls_back_to_any_xml_entry() {
        let path = temp_file("Alt.fadein", &zip_with(&[("script.xml", "<document version=\"20\"/>")]));
        assert_eq!(read_fadein(&path).unwrap().xml, "<document version=\"20\"/>");
    }

    #[test]
    fn explains_files_that_are_not_scripts() {
        let path = temp_file("Notes.fadein", b"plain text, not a zip");
        let err = read_fadein(&path).unwrap_err();
        assert!(err.starts_with("Notes.fadein couldn't be opened"), "{err}");

        let empty = temp_file("Empty.fadein", &zip_with(&[("readme.txt", "hi")]));
        assert!(read_fadein(&empty).unwrap_err().contains("no screenplay"));
    }

    #[test]
    fn drag_and_drop_accepts_only_fadein() {
        assert!(load_script("/tmp/script.pdf".into()).unwrap_err().contains(".fadein"));
        assert!(is_fadein(Path::new("A.FADEIN")));
    }
}
