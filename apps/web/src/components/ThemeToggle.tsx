import { useState, useEffect } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const sun = "\u{1F31E}";
  const moon = "\u{1F31C}";

  return (
    <button
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      style={{
        background: "none",
        border: "none",
        color: "inherit",
        cursor: "pointer",
        fontSize: "1.1rem",
        padding: "4px 8px",
        borderRadius: "4px",
      }}
    >
      {theme === "dark" ? sun : moon}
    </button>
  );
}
