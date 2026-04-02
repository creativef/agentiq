import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, company: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Check session on load
    fetch("/api/auth/me", { credentials: "include" })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await fetch("/api/auth/login", { method: "POST", credentials: "include", body: JSON.stringify({ email, password: pass }), headers: { "Content-Type": "application/json" } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setUser({ id: data.user.id, email: data.user.email });
  };

  const register = async (email: string, pass: string, company: string) => {
    const res = await fetch("/api/auth/register", { method: "POST", credentials: "include", body: JSON.stringify({ email, password: pass, companyName: company }), headers: { "Content-Type": "application/json" } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setUser({ id: data.user.id, email: data.user.email });
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
