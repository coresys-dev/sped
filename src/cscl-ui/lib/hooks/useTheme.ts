import { useEffect } from "react";

export type Theme = "dark" | "light";

/** Applies the theme to `<html>` via `data-theme`, read by the
 * `[data-theme="light"]` overrides in theme/tokens.css. `null` (preference
 * not loaded yet) leaves it untouched — the CSS's dark default applies. */
export function useTheme(theme: Theme | null) {
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
  }, [theme]);
}
