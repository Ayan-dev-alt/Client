import { useEffect, useMemo, useState } from "react";
import { ThemeContext } from "./theme";

function readTheme() {
  try { return localStorage.getItem("nbf-theme") === "light" ? "light" : "dark"; }
  catch { return "dark"; }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readTheme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("nbf-theme", theme); } catch { /* Browser storage can be disabled. */ }
  }, [theme]);
  const value = useMemo(() => ({ theme, setTheme, toggleTheme: () => setTheme((current) => current === "dark" ? "light" : "dark") }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

