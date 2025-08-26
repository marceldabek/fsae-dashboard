export type Theme = "light" | "dark";

export const applyTheme = (t: Theme) => {
  const root = document.documentElement;
  root.classList.toggle("dark", t === "dark");
  root.style.colorScheme = t;
  localStorage.setItem("theme", t);
};

export const initTheme = () => {
  const stored = localStorage.getItem("theme") as Theme | null;
  const prefers = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(stored ?? (prefers ? "dark" : "light"));
};
