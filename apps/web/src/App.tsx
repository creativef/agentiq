import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import ThemeToggle from "./components/ThemeToggle";

export default function App() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">
        <TopBar active="Overview" />
        <ThemeToggle />
        <h1>Mission Control</h1>
      </main>
    </div>
  );
}
