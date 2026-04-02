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
    <Route path="dashboard" element={<DashboardLayout><DashboardPage /></DashboardLayout>} />
    <Route path="tasks" element={<DashboardLayout><TaskBoard /></DashboardLayout>} />
    <Route path="agents" element={<DashboardLayout><AgentsPage /></DashboardLayout>} />
    <Route path="calendar" element={<DashboardLayout><CalendarMeetings /></DashboardLayout>} />
    <Route path="files" element={<DashboardLayout><FileHub /></DashboardLayout>} />
    <Route path="chat" element={<DashboardLayout><ChatJournal /></DashboardLayout>} />
    <Route path="org" element={<DashboardLayout><CompanyOrg /></DashboardLayout>} />
    <Route path="company" element={<DashboardLayout><CompanySettings /></DashboardLayout>} />
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
