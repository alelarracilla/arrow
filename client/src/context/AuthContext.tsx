import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useWallet } from "./WalletContext";
import { authWallet, getMe, setToken, getToken, type User } from "../api/client";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isConnected, address } = useWallet();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(async () => {
    if (!getToken()) return;
    try {
      const { user: u } = await getMe();
      setUser(u);
    } catch {
      // Token expired or invalid
      setToken(null);
      setUser(null);
    }
  }, []);

  // When wallet connects, authenticate with backend
  useEffect(() => {
    if (!isConnected || !address) {
      setUser(null);
      setToken(null);
      return;
    }

    const authenticate = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const existing = getToken();
        if (existing) {
          try {
            const { user: u } = await getMe();
            setUser(u);
            setIsLoading(false);
            return;
          } catch {
            // Token invalid, re-auth
            // something something, ale will figure out
          }
        }

        const { token, user: u } = await authWallet(address);
        setToken(token);
        setUser(u);
      } catch (err) {
        console.error("Auth error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
      } finally {
        setIsLoading(false);
      }
    };

    authenticate();
  }, [isConnected, address]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
