import { useState, useEffect } from 'react';
import designTokens from '../../design-tokens.json';

type Theme = 'light' | 'dark';

interface DesignTokens {
  color: Record<string, string>;
  typography: {
    size: Record<string, string>;
    weight: Record<string, number>;
    family: Record<string, string>;
  };
  spacing: Record<string, string>;
  gradients: Record<string, string>;
  radii: Record<string, string>;
}

export function useDesignTokens() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // Check for user preference or system preference
    const savedTheme = localStorage.getItem('theme') as Theme;
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setTheme(savedTheme || systemTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const tokens: DesignTokens = {
    color: designTokens.themes[theme].color,
    typography: designTokens.typography,
    spacing: designTokens.spacing,
    gradients: designTokens.gradients,
    radii: designTokens.radii
  };

  return {
    theme,
    toggleTheme,
    tokens
  };
}
