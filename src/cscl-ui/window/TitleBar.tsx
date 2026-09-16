import { useRef } from "react";
import { WindowControls } from "./WindowControls";
import { useNativeTrafficLights } from "../lib/hooks/useNativeTrafficLights";

/** In normal document flow (not a `fixed` overlay), mounted above the main
 * column: reserves its own height, so it can never cover a clickable
 * element beneath it. Reconstructed controls (`WindowControls`) on
 * Windows/Linux, always in their own floating island top-right (same
 * margin/radius as every other floating panel, see theme/tokens.css); on
 * macOS that same island is the target the native traffic lights get
 * repositioned into (see `useNativeTrafficLights` / window/README.md), so
 * the window's native rounded corners stay intact. When a tab bar (or any
 * other bar) already hosts this same island at its own height, pass
 * `mergedElsewhere` so this bar disappears entirely instead of leaving an
 * empty strip above it. */
export function TitleBar({
  mergedElsewhere = false,
  revealed = true,
}: {
  mergedElsewhere?: boolean;
  /** `false` until your app's own startup choreography reveals the shell —
   * the island stays invisible rather than popping in ahead of the rest of
   * it (see `.animate-chrome-in` in theme/motion.css). Defaults to `true`
   * for callers that don't orchestrate a startup sequence — `TitleBar`
   * shouldn't stay invisible without an explicit signal that reveals it. */
  revealed?: boolean;
}) {
  const islandRef = useRef<HTMLDivElement>(null);
  useNativeTrafficLights(islandRef);

  if (mergedElsewhere) return null;

  return (
    <div data-tauri-drag-region className="m-3 mb-0 flex h-9 shrink-0 justify-end">
      <div
        ref={islandRef}
        className={`flex shrink-0 items-stretch overflow-hidden rounded-lg border border-border bg-surface shadow-float ${
          revealed ? "animate-chrome-in" : "opacity-0"
        }`}
      >
        <WindowControls />
      </div>
    </div>
  );
}
