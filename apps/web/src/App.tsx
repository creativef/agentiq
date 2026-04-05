import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Login from "./pages/Login";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";
import AgentsPage from "./pages/AgentsPage";
import TaskBoard from "./pages/TaskBoard";
import TaskHistory from "./pages/TaskHistory";
import CompanyBriefsPage from "./pages/CompanyBriefsPage";
import LLMConfigPage from "./pages/LLMConfigPage";
import CalendarMeetings from "./pages/CalendarMeetings";
import ChatJournal from "./pages/ChatJournal";
import JournalPage from "./pages/JournalPage";
import FileHub from "./pages/FileHub";
import CompanyOrg from "./pages/CompanyOrg";
import CompanySettings from "./pages/CompanySettings";
import ConnectorsPage from "./pages/ConnectorsPage";
import ProjectsPage from "./pages/ProjectsPage";

const ProtectedRoute = () => {
  const { user } = useAuth();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

const AuthedApp = () => (
  <Routes>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route path="dashboard" element={<DashboardLayout />}>
      <Route index element={<DashboardPage />} />
    </Route>
    <Route path="tasks" element={<DashboardLayout />}>
      <Route index element={<TaskBoard />} />
    </Route>
    <Route path="agents" element={<DashboardLayout />}>
      <Route index element={<AgentsPage />} />
    </Route>
    <Route path="projects" element={<DashboardLayout />}>
      <Route index element={<ProjectsPage />} />
    </Route>
    <Route path="history" element={<DashboardLayout />}>
      <Route index element={<TaskHistory />} />
    </Route>
    <Route path="brief" element={<DashboardLayout />}>
      <Route index element={<CompanyBriefsPage />} />
    </Route>
    <Route path="brain" element={<DashboardLayout />}>
      <Route index element={<LLMConfigPage />} />
    </Route>
    <Route path="calendar" element={<DashboardLayout />}>
      <Route index element={<CalendarMeetings />} />
    </Route>
    <Route path="files" element={<DashboardLayout />}>
      <Route index element={<FileHub />} />
    </Route>
    <Route path="chat" element={<DashboardLayout />}>
      <Route index element={<ChatJournal />} />
    </Route>
    <Route path="journal" element={<DashboardLayout />}>
      <Route index element={<JournalPage />} />
    </Route>
    <Route path="org" element={<DashboardLayout />}>
      <Route index element={<CompanyOrg />} />
    </Route>
    <Route path="company" element={<DashboardLayout />}>
      <Route index element={<CompanySettings />} />
    </Route>
    <Route path="integrations" element={<DashboardLayout />}>
      <Route index element={<ConnectorsPage />} />
    </Route>
  </Routes>
);

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={<ProtectedRoute />}>
              <Route path="*" element={
                <ErrorBoundary>
                  <AuthedApp />
                </ErrorBoundary>
              } />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
