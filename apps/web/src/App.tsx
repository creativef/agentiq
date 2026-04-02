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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={
          <AuthProvider>
            <Login />
          </AuthProvider>
        } />

        <Route path="/" element={
          <AuthProvider>
            <ProtectedRoute />
          </AuthProvider>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={
            <DashboardLayout>
              <DashboardPage />
            </DashboardLayout>
          } />
          <Route path="tasks" element={
            <DashboardLayout>
              <Placeholder name="Tasks" />
            </DashboardLayout>
          } />
          <Route path="agents" element={
            <DashboardLayout>
              <Placeholder name="Agents" />
            </DashboardLayout>
          } />
          <Route path="calendar" element={
            <DashboardLayout>
              <Placeholder name="Calendar" />
            </DashboardLayout>
          } />
          <Route path="files" element={
            <DashboardLayout>
              <Placeholder name="Files" />
            </DashboardLayout>
          } />
          <Route path="chat" element={
            <DashboardLayout>
              <Placeholder name="Chat" />
            </DashboardLayout>
          } />
          <Route path="org" element={
            <DashboardLayout>
              <Placeholder name="Org Chart" />
            </DashboardLayout>
          } />
          <Route path="company" element={
            <DashboardLayout>
              <Placeholder name="Company Settings" />
            </DashboardLayout>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
