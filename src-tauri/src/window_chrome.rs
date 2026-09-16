/// Backs `cscl-ui`'s `useNativeTrafficLights` hook (see
/// `src/cscl-ui/window/README.md`): on macOS the native traffic-light
/// buttons need to be repositioned into the same floating island the
/// custom `WindowControls` renders into on Windows/Linux. We don't have a
/// macOS machine to build/test the Cocoa/objc repositioning logic against,
/// so this stays a documented no-op everywhere for now rather than shipping
/// unverified `unsafe` FFI -- traffic lights just stay in their default
/// top-left position on macOS until this is implemented for real. Windows
/// (this app's actual target for the MVP) is unaffected: it uses the fully
/// custom `WindowControls`, not this command, per `tauri.windows.conf.json`.
#[tauri::command]
pub fn position_traffic_lights(
    _window: tauri::WebviewWindow,
    _x: f64,
    _y: f64,
    _width: f64,
    _height: f64,
) {
}
