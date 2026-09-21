const THEME_KEY = "wesaw.theme";

export type ThemeName = "default" | "amoled";

export function getTheme(): ThemeName {
  try {
    return localStorage.getItem(THEME_KEY) === "amoled" ? "amoled" : "default";
  } catch {
    return "default";
  }
}

export function applyTheme(theme: ThemeName) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "amoled" ? "#000000" : "#0e0f13");
}

export function setTheme(theme: ThemeName) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    console.warn("Could not persist the theme choice.");
  }
  applyTheme(theme);
}
