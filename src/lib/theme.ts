import { useEffect } from "react";

export type Theme = "light";

export function getInitialTheme(): Theme {
  return "light";
}

export function applyTheme(_theme?: Theme) {
  if (typeof window !== "undefined") {
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("mindx_theme");
  }
}

export function useTheme() {
  useEffect(() => {
    applyTheme("light");
  }, []);

  return { theme: "light" as Theme, setTheme: () => {}, toggleTheme: () => {} };
}
