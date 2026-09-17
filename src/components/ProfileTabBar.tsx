import { useState, type ReactNode } from "react";
import { ConfirmDialog } from "../cscl-ui/overlays/ConfirmDialog";
import { TabBar } from "../cscl-ui/navigation/TabBar";

export interface ProfileTabBarProps {
  profiles: string[];
  activeProfile: string;
  onSelect: (name: string) => void;
  onCreate: (name: string) => void;
  onDelete: (name: string) => void;
  /** Rendered pinned at the trailing edge of the tab island (profile
   * actions menu, settings button — anything that isn't itself a tab). */
  trailing?: ReactNode;
}

/** Title-bar replacement: profiles as browser-style tabs (cscl-ui
 * `TabBar`), which embeds its own window-controls island at the trailing
 * edge -- so this is the app's whole title bar, two islands side by side,
 * no wrapper needed. */
export function ProfileTabBar({
  profiles,
  activeProfile,
  onSelect,
  onCreate,
  onDelete,
  trailing,
}: ProfileTabBarProps) {
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  return (
    <>
      <TabBar
        tabs={profiles.map((name) => ({ id: name, label: name }))}
        activeTabId={activeProfile}
        onSelectTab={onSelect}
        onCloseTab={setPendingDelete}
        onNewTab={() => {
          setNewName("");
          setCreating(true);
        }}
        labels={{ close: "Delete profile", new: "New profile" }}
        trailing={trailing}
      />

      {pendingDelete && (
        <ConfirmDialog
          title="Delete profile"
          body={`Delete profile "${pendingDelete}"? This can't be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            onDelete(pendingDelete);
            setPendingDelete(null);
          }}
        />
      )}

      {creating && (
        <ConfirmDialog
          title="New profile"
          body="Name the new profile."
          confirmLabel="Create"
          cancelLabel="Cancel"
          confirmVariant="primary"
          onCancel={() => setCreating(false)}
          onConfirm={() => {
            const name = newName.trim();
            if (name) onCreate(name);
            setCreating(false);
          }}
          content={
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const name = newName.trim();
                if (name) onCreate(name);
                setCreating(false);
              }}
              placeholder="Profile name"
              className="mb-4 w-full rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-xs text-text outline-none focus:border-accent"
            />
          }
        />
      )}
    </>
  );
}
