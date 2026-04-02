import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  email: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, pass: string) => Promise<void>;
  register: (email: string, pass: string, company: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Check session on load
    fetch("/api/auth/me", { credentials: "include" })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        if (data?.user) setUser(data.user);
        setHydrated(true);
      })
      .catch(() => {
        setUser(null);
        setHydrated(true);
      });
  }, []);

  const login = async (email: string, pass: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ email, password: pass }),
      headers: { "Content-Type": "application/json" }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    setUser(data.user);
  };

  const register = async (email: string, pass: string, company: string) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ email, password: pass, companyName: company }),
      headers: { "Content-Type": "application/json" }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");
    setUser(data.user);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  };

  if (!hydrated) return null;

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
