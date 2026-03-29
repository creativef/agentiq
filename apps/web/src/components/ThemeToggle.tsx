import { useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState("light");
  return (
    <button
      aria-label="theme"
      onClick={() => {
        const next = theme === "light" ? "dark" : "light";
        setTheme(next);
        document.documentElement.dataset.theme = next;
      }}
    >
      Theme
    </button>
  );
}
