import { useRef } from "react";
import { DropdownMenu } from "../cscl-ui/overlays/DropdownMenu";

export interface ProfileManagerProps {
  activeProfile: string;
  onDuplicate: (name: string) => void;
  onRename: (name: string) => void;
  onExport: () => void;
  onImport: (json: string) => void;
}

/** Actions on the *active* profile that don't fit `ProfileTabBar`'s plain
 * select/close/new (that component owns switching, creating and deleting
 * profiles as tabs in the title bar). */
export function ProfileManager({
  activeProfile,
  onDuplicate,
  onRename,
  onExport,
  onImport,
}: ProfileManagerProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu
        triggerLabel="Profile actions"
        expandDirection="right"
        items={[
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
