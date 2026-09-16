import { useEffect } from "react";
import type { RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import { isMacOS } from "../../window/WindowControls";

/** Reports the exact rect (screen CSS coordinates) of the rendered window
 * controls island to the Rust backend, so macOS's native traffic lights
 * (repositioned Rust-side) land exactly inside it instead of at a
 * hard-coded guessed offset. No-op on other platforms (controls are
 * reconstructed in JS, see `WindowControls`).
 *
 * Requires a `position_traffic_lights(x, y, width, height)` Tauri command in
 * the consuming app's Rust backend — see window/README.md for the exact
 * implementation to port alongside this hook. */
export function useNativeTrafficLights(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!isMacOS) return;

    const report = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      invoke("position_traffic_lights", {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      }).catch(() => {});
    };

    report();
    const raf = requestAnimationFrame(report);
    window.addEventListener("resize", report);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", report);
    };
  }, [ref]);
}
