import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";
import AgentsPage from "./pages/AgentsPage";
import TaskBoard from "./pages/TaskBoard";
import CalendarMeetings from "./pages/CalendarMeetings";
import ChatJournal from "./pages/ChatJournal";
import FileHub from "./pages/FileHub";
import CompanyOrg from "./pages/CompanyOrg";
import CompanySettings from "./pages/CompanySettings";

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
    <Route path="calendar" element={<DashboardLayout />}>
      <Route index element={<CalendarMeetings />} />
    </Route>
    <Route path="files" element={<DashboardLayout />}>
      <Route index element={<FileHub />} />
    </Route>
    <Route path="chat" element={<DashboardLayout />}>
      <Route index element={<ChatJournal />} />
    </Route>
    <Route path="org" element={<DashboardLayout />}>
      <Route index element={<CompanyOrg />} />
    </Route>
    <Route path="company" element={<DashboardLayout />}>
      <Route index element={<CompanySettings />} />
    </Route>
  </Routes>
);

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<ProtectedRoute />}>
            <Route path="*" element={<AuthedApp />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
