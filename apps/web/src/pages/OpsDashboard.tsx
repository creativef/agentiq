import KpiTiles from "../components/Overview/KpiTiles";
import StatusWall from "../components/Overview/StatusWall";
import OpsTimeline from "../components/Overview/OpsTimeline";
import QuickActions from "../components/Overview/QuickActions";
import CompanyPanel from "../components/Overview/CompanyPanel";

export default function OpsDashboard() {
  return (
    <section>
      <h1>Overview</h1>
      <CompanyPanel />
      <KpiTiles />
      <StatusWall />
      <OpsTimeline />
      <QuickActions />
    </section>
  );
}
