import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Login from "./pages/Login";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardPage from "./pages/DashboardPage";

const Placeholder = ({ name }: { name: string }) => (
  <div style={{ padding: "2rem" }}>
    <h1>{name}</h1>
    <p style={{ color: "#888" }}>Coming soon in Phase 1...</p>
  </div>
);

const ProtectedRoute = () => {
  const { user } = useAuth();
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

const AuthedApp = () => (
  <Routes>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route path="dashboard" element={<DashboardLayout><DashboardPage /></DashboardLayout>} />
    <Route path="tasks" element={<DashboardLayout><Placeholder name="Tasks" /></DashboardLayout>} />
    <Route path="agents" element={<DashboardLayout><Placeholder name="Agents" /></DashboardLayout>} />
    <Route path="calendar" element={<DashboardLayout><Placeholder name="Calendar" /></DashboardLayout>} />
    <Route path="files" element={<DashboardLayout><Placeholder name="Files" /></DashboardLayout>} />
    <Route path="chat" element={<DashboardLayout><Placeholder name="Chat" /></DashboardLayout>} />
    <Route path="org" element={<DashboardLayout><Placeholder name="Org Chart" /></DashboardLayout>} />
    <Route path="company" element={<DashboardLayout><Placeholder name="Company Settings" /></DashboardLayout>} />
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
