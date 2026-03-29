const tabs = ["Overview", "Chat", "Tasks", "Calendar", "Files"];

export default function TopBar({ active }: { active: string }) {
  return (
    <header>
      <div>Mission Control</div>
      <nav>
        {tabs.map((tab) => (
          <span key={tab} aria-current={tab === active ? "page" : undefined}>
            {tab}
          </span>
        ))}
      </nav>
    </header>
  );
}
