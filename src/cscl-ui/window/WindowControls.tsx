import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Copy, Minus, Square, X } from "lucide-react";

const appWindow = getCurrentWindow();

/** macOS keeps native decorations (`titleBarStyle: "Overlay"` +
 * `hiddenTitle: true` in tauri.conf.json) to get the window's native rounded
 * corners and drop shadow back — the native traffic lights are repositioned
 * Rust-side (see window/README.md) into this same island rather than drawn
 * here. */
export const isMacOS = navigator.platform.toLowerCase().includes("mac");

/** Width reserved for the repositioned native traffic-light group (must
 * match the Rust-side positioning constants — see window/README.md): the
 * island keeps this width even when no custom button renders into it. */
const MACOS_TRAFFIC_LIGHTS_WIDTH = 72;

/** Reconstructed minimize/maximize/close trio for Windows/Linux
 * (`decorations: false` in tauri.conf.json) — no bar of its own, meant to
 * slot into whatever bar already exists (a bare drag strip, a tab bar) via
 * `className` rather than impose its own separate row. On macOS renders
 * nothing (the repositioned native traffic lights take its place) but still
 * reserves the expected width so the island doesn't collapse. */
export function WindowControls({ className = "" }: { className?: string }) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (isMacOS) return;
    let unlisten: (() => void) | undefined;
    appWindow.isMaximized().then(setMaximized).catch(() => {});
    appWindow
      .onResized(() => {
        appWindow.isMaximized().then(setMaximized).catch(() => {});
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  }, []);

  if (isMacOS) {
    return <div aria-hidden style={{ width: MACOS_TRAFFIC_LIGHTS_WIDTH }} className={className} />;
  }

  return (
    <div className={`flex select-none items-stretch ${className}`}>
      <button
        type="button"
        aria-label="Minimize"
        onClick={() => appWindow.minimize()}
        className="flex w-11 items-center justify-center text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        aria-label={maximized ? "Restore" : "Maximize"}
        onClick={() => appWindow.toggleMaximize()}
        className="flex w-11 items-center justify-center text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
      >
        {maximized ? <Copy size={13} className="-scale-x-100" /> : <Square size={12} />}
      </button>
      <button
        type="button"
        aria-label="Close"
        onClick={() => appWindow.close()}
        className="flex w-11 items-center justify-center text-text-muted transition-colors hover:bg-danger hover:text-white"
      >
        <X size={14} />
      </button>
    </div>
  );
}
