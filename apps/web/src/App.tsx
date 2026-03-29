import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";

export default function App() {
  return (
    <div>
      <Sidebar />
      <main>
        <TopBar active="Overview" />
        <h1>Mission Control</h1>
      </main>
    </div>
  );
}
