import { useRef, useState } from "react";
import styles from "./ProfileManager.module.css";

export interface ProfileManagerProps {
  profiles: string[];
  activeProfile: string;
  onSelect: (name: string) => void;
  onCreate: (name: string) => void;
  onDuplicate: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onExport: () => void;
  onImport: (json: string) => void;
}

export function ProfileManager({
  profiles,
  activeProfile,
  onSelect,
  onCreate,
  onDuplicate,
  onRename,
  onDelete,
  onExport,
  onImport,
}: ProfileManagerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className={styles.wrap}>
      <select
        className={styles.select}
        value={activeProfile}
        onChange={(e) => onSelect(e.target.value)}
      >
        {profiles.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <button
        type="button"
        className={styles.menuButton}
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Profile actions"
      >
        ⋯
      </button>

      {menuOpen && (
        <div className={styles.menu} onMouseLeave={() => setMenuOpen(false)}>
          <button
            type="button"
            onClick={() => {
              const name = window.prompt("New profile name?");
              if (name) onCreate(name);
              setMenuOpen(false);
            }}
          >
            New profile
          </button>
          <button
            type="button"
            onClick={() => {
              const name = window.prompt("Duplicate as?", `${activeProfile} copy`);
              if (name) onDuplicate(name);
              setMenuOpen(false);
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => {
              const name = window.prompt("Rename profile to?", activeProfile);
              if (name) onRename(name);
              setMenuOpen(false);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete profile "${activeProfile}"?`)) onDelete();
              setMenuOpen(false);
            }}
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => {
              onExport();
              setMenuOpen(false);
            }}
          >
            Export…
          </button>
          <button
            type="button"
            onClick={() => {
              fileInput.current?.click();
              setMenuOpen(false);
            }}
          >
            Import…
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className={styles.hiddenInput}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) onImport(await file.text());
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}
