import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";
import { IconButton } from "../primitives/IconButton";

const CLOSE_ANIM_MS = 150;

export interface DropdownMenuItem {
  label: string;
  onClick: () => void;
}

export interface DropdownMenuProps {
  items: DropdownMenuItem[];
  triggerLabel: string;
  /** Trigger button content. Defaults to a "⋯" icon (`MoreHorizontal`). */
  triggerIcon?: ReactNode;
  /** Which way the menu expands from the trigger. `"right"` (default), or
   * `"left"` for a trigger sitting near the right edge of its container,
   * where an expand-right menu would run off the window. */
  expandDirection?: "left" | "right";
}

type Position = { top: number } & ({ left: number; right?: never } | { right: number; left?: never });

/** A "⋯"-style trigger that opens a small action list — same pattern
 * anywhere a card/row/detail page needs a compact overflow menu.
 *
 * Portaled to `document.body` and positioned with `position: fixed` from the
 * trigger's own measured coordinates, rather than a locally `absolute`
 * dropdown: an ancestor with an entrance animation that leaves a non-`none`
 * `transform` behind (fill-mode `both` freezes the final keyframe) becomes a
 * containing block for its positioned descendants per the CSS spec — a
 * same-tree dropdown would get trapped inside it (and clipped by any
 * `overflow` ancestor). Positioning from measured viewport coordinates
 * sidesteps that.
 *
 * Animates open (`animate-menu-in`) and closed (`animate-menu-out`, held
 * mounted for `CLOSE_ANIM_MS` before actually unmounting) rather than
 * popping in/out instantly. For a right-click context menu positioned at
 * pointer coordinates instead of a trigger element, use `ContextMenu`. */
export function DropdownMenu({ items, triggerLabel, triggerIcon, expandDirection = "right" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function close() {
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, CLOSE_ANIM_MS);
  }

  function openMenu() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition(
        expandDirection === "right"
          ? { top: rect.bottom + 4, left: rect.left }
          : { top: rect.bottom + 4, right: window.innerWidth - rect.right },
      );
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open || closing) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    // A stale fixed position beats a live one — closing on scroll/resize is
    // simpler and safer than re-measuring continuously for a lightweight menu.
    function onScrollOrResize() {
      close();
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, closing]);

  return (
    <>
      <IconButton
        ref={triggerRef}
        variant="ghost"
        size="md"
        aria-label={triggerLabel}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          if (open) close();
          else openMenu();
        }}
      >
        {triggerIcon ?? <MoreHorizontal size={16} />}
      </IconButton>
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              top: position.top,
              left: position.left,
              right: position.right,
              transformOrigin: expandDirection === "right" ? "top left" : "top right",
            }}
            className={`fixed z-50 min-w-[168px] overflow-hidden rounded-md border border-border bg-surface-raised py-1 shadow-float ${
              closing ? "animate-menu-out" : "animate-menu-in"
            }`}
          >
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  close();
                  item.onClick();
                }}
                className="block w-full px-3 py-2 text-left text-sm text-text transition-colors duration-150 hover:bg-surface-hover"
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
