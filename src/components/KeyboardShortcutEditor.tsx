import { useState } from "react";
import styles from "./KeyboardShortcutEditor.module.css";

const MODIFIER_KEYS = new Set(["Control", "Shift", "Alt", "Meta"]);

function normalizeKey(e: KeyboardEvent): string {
  if (e.key === "Control") return "CTRL";
  if (e.key === "Shift") return "SHIFT";
  if (e.key === "Alt") return "ALT";
  if (e.key === "Meta") return "META";
  if (e.key === " ") return "SPACE";
  if (e.key.length === 1) return e.key.toUpperCase();
  return e.key.toUpperCase();
}

export interface KeyboardShortcutEditorProps {
  onConfirm: (keys: string[]) => void;
  onCancel: () => void;
}

export function KeyboardShortcutEditor({ onConfirm, onCancel }: KeyboardShortcutEditorProps) {
  const [keys, setKeys] = useState<string[]>([]);
  const [listening, setListening] = useState(false);

  const startListening = () => {
    setKeys([]);
    setListening(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!listening) return;
    e.preventDefault();
    const name = normalizeKey(e.nativeEvent);
    setKeys((prev) => (prev.includes(name) ? prev : [...prev, name]));
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (!listening) return;
    if (!MODIFIER_KEYS.has(e.key)) {
      setListening(false);
    }
  };

  return (
    <div className={styles.editor}>
      <div className={styles.label}>Keyboard Shortcut</div>
      <div
        className={[styles.captureBox, listening && styles.listening].filter(Boolean).join(" ")}
        tabIndex={0}
        onClick={startListening}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={() => setListening(false)}
      >
        {keys.length === 0 ? (
          <span className={styles.placeholder}>
            {listening ? "Press keys…" : "Click, then press a combination"}
          </span>
        ) : (
          keys.map((k) => (
            <span key={k} className={styles.chip}>
              {k}
            </span>
          ))
        )}
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={keys.length === 0}
          onClick={() => onConfirm(keys)}
        >
          Add
        </button>
      </div>
    </div>
  );
}
