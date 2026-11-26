//! Midlander's desktop shell: window, native menus and file access.
//!
//! The screenplay model, editing, .fadein parsing and pagination all live in
//! the TypeScript packages. This side only does what a webview can't: native
//! menus, the Open and Save dialogs, and reading and writing files.
//!
//! Every menu item here does something. Items for features that aren't built
//! yet are left out rather than shown disabled or as placeholders.
//!
//! Fade In scripts (.fadein) are only ever read. Saving always writes a
//! Midlander script (.midlander), so an original Fade In file can't be
//! overwritten by accident.

use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::menu::{AboutMetadataBuilder, Menu, MenuBuilder, MenuItem, MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Emitter, Manager, RunEvent, State, WindowEvent, Wry};
use tauri_plugin_dialog::DialogExt;

/// Largest script file Midlander will try to open (a feature-length script is well under 1 MB).
const MAX_FILE_BYTES: u64 = 64 * 1024 * 1024;

/// Menu items whose state follows the document, and whether it has unsaved changes.
struct Shell {
    /// Enabled only while a script is open (Close, Save, Format…).
    doc_items: Vec<MenuItem<Wry>>,
    undo: MenuItem<Wry>,
    redo: MenuItem<Wry>,
    dirty: Mutex<bool>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ScriptKind {
    Fadein,
    Midlander,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct RawScript {
    /// File name shown in the window title, e.g. "My Script.fadein".
    name: String,
    path: String,
    kind: ScriptKind,
    /// Open Screenplay Format XML (.fadein) or Midlander JSON (.midlander).
    content: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct SavedScript {
    name: String,
    path: String,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuState {
    open: bool,
    dirty: bool,
    can_undo: bool,
    can_redo: bool,
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Untitled".into())
}

fn has_ext(path: &Path, ext: &str) -> bool {
    path.extension().map(|e| e.eq_ignore_ascii_case(ext)).unwrap_or(false)
}

fn kind_of(path: &Path) -> Option<ScriptKind> {
    if has_ext(path, "fadein") {
        Some(ScriptKind::Fadein)
    } else if has_ext(path, "midlander") {
        Some(ScriptKind::Midlander)
    } else {
        None
    }
}

/// Reads a script file: a zip archive holding document.xml (.fadein) or document.json (.midlander).
pub fn read_script(path: &Path) -> Result<RawScript, String> {
    let name = file_name(path);
    let fail = |why: &str| format!("{name} couldn't be opened: {why}");
    let kind = kind_of(path).ok_or_else(|| fail("Midlander opens Midlander (.midlander) and Fade In (.fadein) scripts."))?;

    let meta = std::fs::metadata(path).map_err(|e| fail(&e.to_string()))?;
    if meta.len() > MAX_FILE_BYTES {
        return Err(fail("the file is too large to be a screenplay."));
    }
    let file = std::fs::File::open(path).map_err(|e| fail(&e.to_string()))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|_| match kind {
        ScriptKind::Fadein => fail("it isn't a Fade In (.fadein) file, or it is damaged."),
        ScriptKind::Midlander => fail("it isn't a Midlander script, or it is damaged."),
    })?;

    let entry_name = {
        let names: Vec<String> = archive.file_names().map(String::from).collect();
        let wanted = match kind {
            ScriptKind::Fadein => names
                .iter()
                .find(|n| n.as_str() == "document.xml")
                .or_else(|| names.iter().find(|n| n.ends_with(".xml"))),
            ScriptKind::Midlander => names.iter().find(|n| n.as_str() == "document.json"),
        };
        wanted.cloned().ok_or_else(|| fail("there is no screenplay inside the file."))?
    };
    let mut entry = archive.by_name(&entry_name).map_err(|e| fail(&e.to_string()))?;
    if entry.size() > MAX_FILE_BYTES {
        return Err(fail("the screenplay inside is too large."));
    }
    let mut content = String::new();
    entry
        .read_to_string(&mut content)
        .map_err(|_| fail("the screenplay inside couldn't be read as text."))?;
    Ok(RawScript { name, path: path.to_string_lossy().into_owned(), kind, content })
}

/// The path a save goes to: always a .midlander file.
fn midlander_path(path: PathBuf) -> PathBuf {
    if has_ext(&path, "midlander") {
        path
    } else {
        let mut s = path.into_os_string();
        s.push(".midlander");
        PathBuf::from(s)
    }
}

/// Writes a Midlander script safely: to a temporary file next to it first,
/// then renamed over the old one, so a failed save never leaves half a file.
pub fn write_midlander(path: &Path, json: &str) -> Result<(), String> {
    if !has_ext(path, "midlander") {
        return Err("Midlander only saves Midlander (.midlander) scripts.".into());
    }
    let dir = path.parent().filter(|p| !p.as_os_str().is_empty()).unwrap_or(Path::new("."));
    let tmp = dir.join(format!(".{}.saving-{}", file_name(path), std::process::id()));
    let result = (|| -> Result<(), String> {
        let file = std::fs::File::create(&tmp).map_err(|e| e.to_string())?;
        let mut w = zip::ZipWriter::new(file);
        let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
        w.start_file("document.json", opts).map_err(|e| e.to_string())?;
        w.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
        let file = w.finish().map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        std::fs::rename(&tmp, path).map_err(|e| e.to_string())
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&tmp);
    }
    result
}

fn emit_menu(app: &AppHandle, id: &str) {
    let _ = app.emit("menu", id);
}

#[tauri::command]
fn open_script(app: AppHandle) {
    let handle = app.clone();
    let mut dialog = app.dialog().file().add_filter("Screenplays", &["midlander", "fadein"]);
    if let Some(window) = app.get_webview_window("main") {
        dialog = dialog.set_parent(&window);
    }
    dialog.pick_file(move |picked| {
        let Some(picked) = picked else { return }; // cancelled
        let result = picked
            .into_path()
            .map_err(|e| format!("That file couldn't be opened: {e}"))
            .and_then(|p| read_script(&p));
        let _ = match result {
            Ok(script) => handle.emit("script-opened", script),
            Err(message) => handle.emit("script-open-failed", message),
        };
    });
}

/// Used when a file is dragged onto the window.
#[tauri::command]
fn load_script(path: String) -> Result<RawScript, String> {
    read_script(Path::new(&path))
}

/// Saves the script. With no path (a new script, or one opened from Fade In),
/// asks where to save it first. Returns None if the person cancels.
#[tauri::command]
async fn save_script(app: AppHandle, path: Option<String>, suggested_name: String, json: String) -> Result<Option<SavedScript>, String> {
    let target = match path {
        Some(p) => PathBuf::from(p),
        None => {
            let mut dialog = app
                .dialog()
                .file()
                .add_filter("Midlander script", &["midlander"])
                .set_file_name(suggested_name);
            if let Some(window) = app.get_webview_window("main") {
                dialog = dialog.set_parent(&window);
            }
            let Some(picked) = dialog.blocking_save_file() else { return Ok(None) };
            midlander_path(picked.into_path().map_err(|e| e.to_string())?)
        }
    };
    write_midlander(&target, &json).map_err(|e| format!("{} couldn't be saved: {e}", file_name(&target)))?;
    Ok(Some(SavedScript { name: file_name(&target), path: target.to_string_lossy().into_owned() }))
}

#[tauri::command]
fn set_menu_state(state: MenuState, shell: State<'_, Shell>) -> Result<(), String> {
    for item in &shell.doc_items {
        item.set_enabled(state.open).map_err(|e| e.to_string())?;
    }
    shell.undo.set_enabled(state.open && state.can_undo).map_err(|e| e.to_string())?;
    shell.redo.set_enabled(state.open && state.can_redo).map_err(|e| e.to_string())?;
    *shell.dirty.lock().unwrap() = state.open && state.dirty;
    Ok(())
}

/// Called by the interface once unsaved changes have been dealt with.
#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn item(app: &AppHandle, id: &str, text: &str, accel: Option<&str>, enabled: bool) -> tauri::Result<MenuItem<Wry>> {
    let mut b = MenuItemBuilder::with_id(id, text).enabled(enabled);
    if let Some(a) = accel {
        b = b.accelerator(a);
    }
    b.build(app)
}

fn build_menu(app: &AppHandle) -> tauri::Result<(Menu<Wry>, Shell)> {
    let mac = cfg!(target_os = "macos");
    let about = AboutMetadataBuilder::new()
        .name(Some("Midlander"))
        .version(Some(app.package_info().version.to_string()))
        .comments(Some("A desktop screenwriting application."))
        .build();

    // File
    let close = item(app, "close", "Close", Some("CmdOrCtrl+W"), false)?;
    let save = item(app, "save", "Save", Some("CmdOrCtrl+S"), false)?;
    let save_as = item(app, "save-as", "Save As…", Some("Shift+CmdOrCtrl+S"), false)?;
    let mut file = SubmenuBuilder::new(app, "File")
        .item(&item(app, "new", "New", Some("CmdOrCtrl+N"), true)?)
        .item(&item(app, "open", "Open…", Some("CmdOrCtrl+O"), true)?)
        .separator()
        .item(&close)
        .item(&save)
        .item(&save_as);
    if !mac {
        file = file.separator().item(&item(app, "quit", "Exit", None, true)?);
    }

    // Edit
    let undo = item(app, "undo", "Undo", Some("CmdOrCtrl+Z"), false)?;
    let redo = item(app, "redo", "Redo", Some(if mac { "Shift+Cmd+Z" } else { "Ctrl+Y" }), false)?;
    let select_all = item(app, "select-all", "Select All", Some("CmdOrCtrl+A"), false)?;
    let edit = SubmenuBuilder::new(app, "Edit")
        .item(&undo)
        .item(&redo)
        .separator()
        .cut()
        .copy()
        .paste()
        .separator()
        .item(&select_all);

    let view = SubmenuBuilder::new(app, "View")
        .item(&item(app, "zoom-in", "Zoom In", Some("CmdOrCtrl+="), true)?)
        .item(&item(app, "zoom-out", "Zoom Out", Some("CmdOrCtrl+-"), true)?)
        .item(&item(app, "zoom-reset", "Zoom 100%", Some("Alt+Shift+CmdOrCtrl+0"), true)?);

    // Format: the elements in Fade In's order and shortcuts, then text styles.
    let elements = [
        ("element-1", "Scene Heading", "CmdOrCtrl+1"),
        ("element-2", "Action", "CmdOrCtrl+2"),
        ("element-3", "Character", "CmdOrCtrl+3"),
        ("element-4", "Parenthetical", "CmdOrCtrl+4"),
        ("element-5", "Dialogue", "CmdOrCtrl+5"),
        ("element-6", "Transition", "CmdOrCtrl+6"),
        ("element-7", "Shot", "CmdOrCtrl+7"),
        ("element-0", "Unformatted Text", "CmdOrCtrl+0"),
    ];
    let mut format_items = Vec::new();
    for (id, text, accel) in elements {
        format_items.push(item(app, id, text, Some(accel), false)?);
    }
    let marks = [("bold", "Bold", "CmdOrCtrl+B"), ("italic", "Italic", "CmdOrCtrl+I"), ("underline", "Underline", "CmdOrCtrl+U")];
    let mut mark_items = Vec::new();
    for (id, text, accel) in marks {
        mark_items.push(item(app, id, text, Some(accel), false)?);
    }
    let mut format = SubmenuBuilder::new(app, "Format");
    for i in &format_items {
        format = format.item(i);
    }
    format = format.separator();
    for i in &mark_items {
        format = format.item(i);
    }

    let mut menu = MenuBuilder::new(app);
    if mac {
        let app_menu = SubmenuBuilder::new(app, "Midlander")
            .about(Some(about.clone()))
            .separator()
            .services()
            .separator()
            .hide()
            .hide_others()
            .show_all()
            .separator()
            .item(&item(app, "quit", "Quit Midlander", Some("Cmd+Q"), true)?)
            .build()?;
        menu = menu.item(&app_menu);
    }
    menu = menu.item(&file.build()?).item(&edit.build()?).item(&view.build()?).item(&format.build()?);
    if mac {
        // Full screen is left out: Fade In uses Option+Enter for it, and the
        // full-screen modes are built with the interface (Phase 4).
        let window = SubmenuBuilder::new(app, "Window").minimize().maximize().build()?;
        menu = menu.item(&window);
    } else {
        let help = SubmenuBuilder::new(app, "Help").about(Some(about)).build()?;
        menu = menu.item(&help);
    }

    let mut doc_items = vec![close, save, save_as, select_all];
    doc_items.extend(format_items);
    doc_items.extend(mark_items);
    Ok((menu.build()?, Shell { doc_items, undo, redo, dirty: Mutex::new(false) }))
}

fn has_unsaved_changes(app: &AppHandle) -> bool {
    app.try_state::<Shell>().map(|s| *s.dirty.lock().unwrap()).unwrap_or(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let (menu, shell) = build_menu(app.handle())?;
            app.set_menu(menu)?;
            app.manage(shell);
            Ok(())
        })
        // Every menu command is carried out by the interface, which knows about
        // unsaved changes and the selection.
        .on_menu_event(|app, event| emit_menu(app, event.id().as_ref()))
        .on_window_event(|window, event| {
            // Closing the window with unsaved changes asks first (the interface decides).
            if let WindowEvent::CloseRequested { api, .. } = event {
                if has_unsaved_changes(window.app_handle()) {
                    api.prevent_close();
                    emit_menu(window.app_handle(), "close-window");
                }
            }
        })
        .invoke_handler(tauri::generate_handler![open_script, load_script, save_script, set_menu_state, quit_app])
        .build(tauri::generate_context!())
        .expect("error while starting Midlander");

    app.run(|app, event| {
        // Quitting another way (e.g. from the Dock) also asks about unsaved changes.
        if let RunEvent::ExitRequested { api, code: None, .. } = event {
            if has_unsaved_changes(app) {
                api.prevent_exit();
                emit_menu(app, "quit");
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("midlander-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn temp_file(name: &str, bytes: &[u8]) -> PathBuf {
        let path = temp_dir().join(name);
        std::fs::write(&path, bytes).unwrap();
        path
    }

    fn zip_with(entries: &[(&str, &str)]) -> Vec<u8> {
        let mut buf = std::io::Cursor::new(Vec::new());
        {
            let mut w = zip::ZipWriter::new(&mut buf);
            for (name, body) in entries {
                let opts = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
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
        let script = read_script(&path).unwrap();
        assert_eq!(script.name, "Pier.fadein");
        assert_eq!(script.kind, ScriptKind::Fadein);
        assert_eq!(script.content, "<document/>");
    }

    #[test]
    fn falls_back_to_any_xml_entry() {
        let path = temp_file("Alt.fadein", &zip_with(&[("script.xml", "<document version=\"20\"/>")]));
        assert_eq!(read_script(&path).unwrap().content, "<document version=\"20\"/>");
    }

    #[test]
    fn explains_files_that_are_not_scripts() {
        let path = temp_file("Notes.fadein", b"plain text, not a zip");
        let err = read_script(&path).unwrap_err();
        assert!(err.starts_with("Notes.fadein couldn't be opened"), "{err}");

        let empty = temp_file("Empty.fadein", &zip_with(&[("readme.txt", "hi")]));
        assert!(read_script(&empty).unwrap_err().contains("no screenplay"));

        assert!(load_script("/tmp/script.pdf".into()).unwrap_err().contains(".fadein"));
        assert_eq!(kind_of(Path::new("A.FADEIN")), Some(ScriptKind::Fadein));
    }

    #[test]
    fn saves_and_reopens_a_midlander_script() {
        let path = temp_dir().join("Draft.midlander");
        write_midlander(&path, "{\"format\":\"midlander\"}").unwrap();
        let back = read_script(&path).unwrap();
        assert_eq!(back.kind, ScriptKind::Midlander);
        assert_eq!(back.content, "{\"format\":\"midlander\"}");
        // Saving again replaces the file and leaves no temporary file behind.
        write_midlander(&path, "{\"v\":2}").unwrap();
        assert_eq!(read_script(&path).unwrap().content, "{\"v\":2}");
        let leftovers: Vec<_> = std::fs::read_dir(temp_dir())
            .unwrap()
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().contains(".saving-"))
            .collect();
        assert!(leftovers.is_empty());
    }

    #[test]
    fn never_writes_a_fade_in_file() {
        let original = temp_file("Original.fadein", b"original bytes");
        assert!(write_midlander(&original, "{}").is_err());
        assert_eq!(std::fs::read(&original).unwrap(), b"original bytes");
        // A name typed in the Save dialog always becomes a .midlander file.
        assert_eq!(midlander_path(PathBuf::from("/x/My Script.fadein")), PathBuf::from("/x/My Script.fadein.midlander"));
        assert_eq!(midlander_path(PathBuf::from("/x/Draft")), PathBuf::from("/x/Draft.midlander"));
        assert_eq!(midlander_path(PathBuf::from("/x/Draft.midlander")), PathBuf::from("/x/Draft.midlander"));
    }
}
