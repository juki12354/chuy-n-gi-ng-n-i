import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PlanCode } from "@/lib/quota";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  "http://localhost:3001";
const TOKEN_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

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
  const refreshInFlight = useRef<Promise<boolean> | null>(null);

  const fetchUser = useCallback(async (authToken: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error("invalid token");
      const data = (await res.json()) as User;
      setUser(data);
    } catch {
      setTokenState(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshSession = useCallback(({ showLoading = false } = {}) => {
    if (refreshInFlight.current) return refreshInFlight.current;
    if (showLoading) setIsLoading(true);

    const run = async () => {
      try {
        const requestRefresh = () =>
          fetch(`${API_URL}/api/auth/refresh`, {
            method: "POST",
            credentials: "include",
          });
        let res = await requestRefresh();
        let data = (await res.json().catch(() => ({}))) as {
          token?: string;
          user?: User;
          retry?: boolean;
        };
        if (res.status === 409 && data.retry) {
          await new Promise((resolve) => window.setTimeout(resolve, 300));
          res = await requestRefresh();
          data = (await res.json().catch(() => ({}))) as typeof data;
        }
        if (!res.ok || !data.token || !data.user) throw new Error("no session");
        setTokenState(data.token);
        setUser(data.user);
        return true;
      } catch {
        setTokenState(null);
        setUser(null);
        return false;
      } finally {
        if (showLoading) setIsLoading(false);
      }
    };

    refreshInFlight.current = run().finally(() => {
      refreshInFlight.current = null;
    });
    return refreshInFlight.current;
  }, []);

  function setToken(newToken: string) {
    setTokenState(newToken);
    void fetchUser(newToken);
  }

  function updateUser(partial: Partial<User>) {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  function logout() {
    const currentToken = token;
    void fetch(`${API_URL}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: currentToken
        ? { Authorization: `Bearer ${currentToken}` }
        : undefined,
    }).catch(() => {});
    setTokenState(null);
    setUser(null);
  }

  useEffect(() => {
    localStorage.removeItem("auth_token");
    void refreshSession({ showLoading: true });
  }, [refreshSession]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(
      () => void refreshSession(),
      TOKEN_REFRESH_INTERVAL_MS,
    );
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void refreshSession();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [user, refreshSession]);

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
