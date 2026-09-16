import { useRef } from "react";
import { DropdownMenu } from "../cscl-ui/overlays/DropdownMenu";

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
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-1">
      <select
        className="rounded-md border border-border bg-surface-raised px-2 py-1.5 text-xs text-text"
        value={activeProfile}
        onChange={(e) => onSelect(e.target.value)}
      >
        {profiles.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>

      <DropdownMenu
        triggerLabel="Profile actions"
        expandDirection="left"
        items={[
          {
            label: "New profile",
            onClick: () => {
              const name = window.prompt("New profile name?");
              if (name) onCreate(name);
            },
          },
          {
            label: "Duplicate",
            onClick: () => {
              const name = window.prompt("Duplicate as?", `${activeProfile} copy`);
              if (name) onDuplicate(name);
            },
          },
          {
            label: "Rename",
            onClick: () => {
              const name = window.prompt("Rename profile to?", activeProfile);
              if (name) onRename(name);
            },
          },
          {
            label: "Delete",
            onClick: () => {
              if (window.confirm(`Delete profile "${activeProfile}"?`)) onDelete();
            },
          },
          { label: "Export…", onClick: onExport },
          { label: "Import…", onClick: () => fileInput.current?.click() },
        ]}
      />

      <input
        ref={fileInput}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) onImport(await file.text());
          e.target.value = "";
        }}
      />
    </div>
  );
}
