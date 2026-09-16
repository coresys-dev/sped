import { useState } from "react";
import { actionCategory, actionLabel, type Action, type ControlId } from "../types";
import { KeyboardShortcutEditor } from "./KeyboardShortcutEditor";
import styles from "./PropertiesPanel.module.css";

export interface PropertiesPanelProps {
  control: ControlId | null;
  actions: Action[];
  onAddAction: (action: Action) => void;
  onRemoveAction: (index: number) => void;
  addKeyboardRequested: boolean;
  onAddKeyboardHandled: () => void;
}

function controlDisplayName(id: ControlId): string {
  return id
    .split("-")
    .map((part) => part.toUpperCase())
    .join(" ");
}

export function PropertiesPanel({
  control,
  actions,
  onAddAction,
  onRemoveAction,
  addKeyboardRequested,
  onAddKeyboardHandled,
}: PropertiesPanelProps) {
  const [showEditor, setShowEditor] = useState(false);

  const editorOpen = showEditor || addKeyboardRequested;

  if (!control) {
    return (
      <aside className={styles.panel}>
        <div className={styles.empty}>Select a control</div>
      </aside>
    );
  }

  return (
    <aside className={styles.panel}>
      <div className={styles.title}>{controlDisplayName(control)}</div>

      <div className={styles.sectionLabel}>Assigned actions</div>

      {actions.length === 0 && <div className={styles.empty}>No actions assigned</div>}

      <ul className={styles.list}>
        {actions.map((action, index) => (
          <li key={index} className={styles.actionRow}>
            <div>
              <div className={styles.actionCategory}>{actionCategory(action)}</div>
              <div className={styles.actionLabel}>{actionLabel(action)}</div>
            </div>
            <button
              type="button"
              className={styles.remove}
              onClick={() => onRemoveAction(index)}
              aria-label="Remove action"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {editorOpen ? (
        <KeyboardShortcutEditor
          onConfirm={(keys) => {
            onAddAction({ kind: "keyboard", keys });
            setShowEditor(false);
            onAddKeyboardHandled();
          }}
          onCancel={() => {
            setShowEditor(false);
            onAddKeyboardHandled();
          }}
        />
      ) : (
        <button type="button" className={styles.addButton} onClick={() => setShowEditor(true)}>
          + Add Action
        </button>
      )}

      <p className={styles.hint}>
        Drag an action from the sidebar onto this control on the visualizer, or add a keyboard
        shortcut here.
      </p>
    </aside>
  );
}
