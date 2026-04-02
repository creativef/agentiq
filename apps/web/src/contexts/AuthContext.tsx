import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router";

interface User {
  id: string;
  email: string;
}

interface Company {
  id: string;
  name: string;
  goal: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  company: Company | null;
  companies: Company[];
  setCompany: (c: Company) => void;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, company: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [company, setCompanyState] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me", { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch("/api/companies", { credentials: "include" }).then(r => r.ok ? r.json() : null),
    ]).then(([me, comp]) => {
      if (me?.user) {
        setUser(me.user);
        if (comp?.companies?.length) {
          setCompanies(comp.companies);
          const stored = localStorage.getItem("activeCompanyId");
          const active = comp.companies.find((c: Company) => c.id === stored) || comp.companies[0];
          setCompanyState(active);
          localStorage.setItem("activeCompanyId", active.id);
          if (window.location.pathname === "/login" || window.location.pathname === "/") {
            navigate("/dashboard", { replace: true });
          }
        }
      }
    });
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await fetch("/api/auth/login", { method: "POST", credentials: "include", body: JSON.stringify({ email, password: pass }), headers: { "Content-Type": "application/json" } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    setUser(data.user);
    const compRes = await fetch("/api/companies", { credentials: "include" });
    const compData = await compRes.json();
    if (compData?.companies?.length) {
      setCompanies(compData.companies);
      const first = compData.companies[0];
      setCompanyState(first);
      localStorage.setItem("activeCompanyId", first.id);
      navigate("/dashboard", { replace: true });
    }
  };

  const register = async (email: string, pass: string, companyName: string) => {
    const res = await fetch("/api/auth/register", { method: "POST", credentials: "include", body: JSON.stringify({ email, password: pass, companyName }), headers: { "Content-Type": "application/json" } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");
    setUser(data.user);
    if (data.company) {
      const nc: Company = { id: data.company.id, name: companyName, goal: "Default Goal", role: "OWNER" };
      setCompanyState(nc);
      setCompanies([nc]);
      localStorage.setItem("activeCompanyId", data.company.id);
      navigate("/dashboard", { replace: true });
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    setCompanyState(null);
    setCompanies([]);
    localStorage.removeItem("activeCompanyId");
    navigate("/login", { replace: true });
  };

  return (
    <AuthContext.Provider value={{ user, company, companies, setCompany: setCompanyState, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
