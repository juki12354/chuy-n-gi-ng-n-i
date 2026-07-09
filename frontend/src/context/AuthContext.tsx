import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { PlanCode } from "@/lib/quota";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3001";
const TOKEN_STORAGE_KEY = "auth_token";

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  avatar: string | null;
  plan?: PlanCode;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  token: string | null;
  setToken: (token: string) => void;
  updateUser: (partial: Partial<User>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  token: null,
  setToken: () => {},
  updateUser: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setTokenState] = useState<string | null>(null);

  async function fetchUser(authToken: string) {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error("invalid token");
      const data = (await res.json()) as User;
      setUser(data);
    } catch {
      if (typeof window !== "undefined")
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      setTokenState(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }

  function setToken(newToken: string) {
    if (typeof window !== "undefined")
      localStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setTokenState(newToken);
    void fetchUser(newToken);
  }

  function updateUser(partial: Partial<User>) {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  function logout() {
    const currentToken = token;
    if (currentToken) {
      void fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${currentToken}` },
      }).catch(() => {});
    }

    if (typeof window !== "undefined")
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    setTokenState(null);
    setUser(null);
  }

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? localStorage.getItem(TOKEN_STORAGE_KEY)
        : null;
    if (stored) {
      setTokenState(stored);
      void fetchUser(stored);
    } else {
      setIsLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, token, setToken, updateUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
