import { useState } from "react";
import { cn } from "../lib/cn";

interface ShortcutRecorderProps {
  value: string;
  onChange: (next: string) => void;
  /** Field stays visible but inert — clicking doesn't start recording. Use
   * when the shortcut this records isn't actually registered right now, so
   * the control's state matches reality. */
  disabled?: boolean;
  /** Shown instead of `value` while actively recording a combo. */
  recordingLabel: string;
  className?: string;
}

/** `e.code` (physical key position) -> the token expected by
 * `tauri_plugin_global_shortcut::Shortcut::from_str`-style shortcut parsers.
 * `e.key` is NOT usable for the main key: on macOS, a key held with Alt/
 * Option produces the alt-graphic/dead-key character (`Alt+S` gives
 * `e.key === "ß"`, not `"s"`), which such parsers reject. `e.code` identifies
 * the physical key regardless of active modifiers or layout, so it's
 * reliable across platforms. */
function mainKeyFromCode(code: string): string | null {
  if (code.startsWith("Key")) return code.slice(3); // "KeyS" -> "S"
  if (code.startsWith("Digit")) return code.slice(5); // "Digit1" -> "1"
  if (code.startsWith("Numpad") && /^Numpad\d$/.test(code)) return code.slice(6); // "Numpad1" -> "1"
  const NAMED: Record<string, string> = {
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Escape: "Escape",
    Space: "Space",
    Tab: "Tab",
    Enter: "Enter",
    Backspace: "Backspace",
    Delete: "Delete",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Minus: "-",
    Equal: "=",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Semicolon: ";",
    Quote: "'",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Backquote: "`",
  };
  if (NAMED[code]) return NAMED[code];
  if (/^F\d{1,2}$/.test(code)) return code; // "F5" -> "F5"
  return null;
}

/** Builds a "Ctrl+Shift+K"-style combo string from the active modifiers and
 * main key. Ignores a `keydown` that's only a modifier (Ctrl/Alt/Shift/Meta)
 * on its own: a real main key is needed to capture a valid combination.
 *
 * DIVERGES FROM UPSTREAM cscl-ui: the original requires at least one
 * modifier, because it targets OS-global hotkey registration (a modifier-
 * less global shortcut would intercept that key everywhere). This app
 * synthesizes keys into the focused application instead of registering
 * global hotkeys, and the Speed Editor spec explicitly needs bare keys
 * (STOP/PLAY -> Space, CUT -> Ctrl+B) -- so a modifier is not required here. */
function comboFromEvent(e: React.KeyboardEvent): string | null {
  const isModifierOnly = ["Control", "Alt", "Shift", "Meta"].includes(e.key);
  if (isModifierOnly) return null;
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Super");
  // `e.code` first (physical key, reliable even under macOS Alt/Option);
  // fall back to `e.key` only for the rare keys `e.code` doesn't map above.
  const key = mainKeyFromCode(e.code) ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key);
  parts.push(key);
  return parts.join("+");
}

/** "Click then press a combination" field for recording a global shortcut.
 * `Escape` cancels without changing the value. */
export function ShortcutRecorder({ value, onChange, disabled = false, recordingLabel, className }: ShortcutRecorderProps) {
  const [recording, setRecording] = useState(false);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.currentTarget.focus();
        setRecording(true);
      }}
      onKeyDown={(e) => {
        if (!recording) return;
        e.preventDefault();
        if (e.key === "Escape") {
          setRecording(false);
          return;
        }
        const combo = comboFromEvent(e);
        if (combo) {
          onChange(combo);
          setRecording(false);
        }
      }}
      onBlur={() => setRecording(false)}
      className={cn(
        "rounded-md border px-3 py-1.5 text-xs uppercase tracking-wide transition-colors disabled:pointer-events-none",
        recording ? "border-accent text-accent" : "border-border text-text-muted hover:text-text",
        className,
      )}
    >
      {recording ? recordingLabel : value}
    </button>
  );
}
