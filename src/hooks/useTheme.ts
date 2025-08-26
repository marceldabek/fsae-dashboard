import { useEffect, useState, useCallback } from "react";
import { applyTheme, initTheme, Theme } from "@/lib/theme";

export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    initTheme();
    setTheme(
      document.documentElement.classList.contains("dark") ? "dark" : "light"
    );
  }, []);

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }, [theme]);

  return { theme, toggle };
};
