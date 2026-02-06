import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { createPublicClient, formatUnits, type Address } from "viem";
import { arcTestnet } from "viem/chains";
import { createBundlerClient } from "viem/account-abstraction";
import { toWebAuthnAccount } from "viem/account-abstraction";
import {
  toCircleSmartAccount,
  toModularTransport,
  toPasskeyTransport,
  toWebAuthnCredential,
  WebAuthnMode,
} from "@circle-fin/modular-wallets-core";

const CLIENT_KEY = import.meta.env.VITE_CIRCLE_CLIENT_KEY;
const CLIENT_URL = import.meta.env.VITE_CIRCLE_CLIENT_URL;

// Arc Testnet: USDC is the native currency (18 decimals)
const NATIVE_USDC_DECIMALS = 18;

interface WalletState {
  isConnected: boolean;
  isLoading: boolean;
  address: Address | null;
  usdcBalance: string;
  smartAccount: ReturnType<typeof toCircleSmartAccount> extends Promise<infer T> ? T | null : never;
  bundlerClient: ReturnType<typeof createBundlerClient> | null;
  error: string | null;
}

interface WalletContextType extends WalletState {
  register: (username: string) => Promise<void>;
  login: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

const passkeyTransport = toPasskeyTransport(CLIENT_URL, CLIENT_KEY);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    isConnected: false,
    isLoading: false,
    address: null,
    usdcBalance: "0",
    smartAccount: null,
    bundlerClient: null,
    error: null,
  });

  const initAccount = useCallback(
    async (credential: Awaited<ReturnType<typeof toWebAuthnCredential>>) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));

      try {
        const modularTransport = toModularTransport(
          `${CLIENT_URL}/arcTestnet`,
          CLIENT_KEY
        );

        const publicClient = createPublicClient({
          chain: arcTestnet,
          transport: modularTransport,
        });

        const smartAccount = await toCircleSmartAccount({
          client: publicClient,
          owner: toWebAuthnAccount({ credential }),
        });

        const bundlerClient = createBundlerClient({
          account: smartAccount,
          chain: arcTestnet,
          transport: modularTransport,
        });

        const address = smartAccount.address;

        // On Arc Testnet, USDC is the native currency
        const usdcBal = await publicClient.getBalance({ address });

        setState({
          isConnected: true,
          isLoading: false,
          address,
          usdcBalance: formatUnits(usdcBal, NATIVE_USDC_DECIMALS),
          smartAccount,
          bundlerClient,
          error: null,
        });
      } catch (err: unknown) {
        console.error("Wallet init error:", err);
        setState((s) => ({
          ...s,
          isLoading: false,
          error: err instanceof Error ? err.message : "Failed to initialize wallet",
        }));
      }
    },
    []
  );

  const register = useCallback(
    async (username: string) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      try {
        const credential = await toWebAuthnCredential({
          transport: passkeyTransport,
          mode: WebAuthnMode.Register,
          username,
        });
        localStorage.setItem("arrow_credential", JSON.stringify(credential));
        await initAccount(credential);
      } catch (err: unknown) {
        console.error("Register error (full):", JSON.stringify(err, Object.getOwnPropertyNames(err as object)));
        console.error("CLIENT_URL:", CLIENT_URL);
        console.error("CLIENT_KEY prefix:", CLIENT_KEY?.slice(0, 20));
        setState((s) => ({
          ...s,
          isLoading: false,
          error: err instanceof Error ? err.message : "Registration failed",
        }));
      }
    },
    [initAccount]
  );

  const login = useCallback(async () => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    try {
      const credential = await toWebAuthnCredential({
        transport: passkeyTransport,
        mode: WebAuthnMode.Login,
      });
      localStorage.setItem("arrow_credential", JSON.stringify(credential));
      await initAccount(credential);
    } catch (err: unknown) {
      console.error("Login error (full):", JSON.stringify(err, Object.getOwnPropertyNames(err as object)));
      console.error("CLIENT_URL:", CLIENT_URL);
      console.error("CLIENT_KEY prefix:", CLIENT_KEY?.slice(0, 20));
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : "Login failed",
      }));
    }
  }, [initAccount]);

  const disconnect = useCallback(() => {
    localStorage.removeItem("arrow_credential");
    setState({
      isConnected: false,
      isLoading: false,
      address: null,
      usdcBalance: "0",
      smartAccount: null,
      bundlerClient: null,
      error: null,
    });
  }, []);

  const refreshBalance = useCallback(async () => {
    if (!state.address) return;

    try {
      const modularTransport = toModularTransport(
        `${CLIENT_URL}/arcTestnet`,
        CLIENT_KEY
      );
      const publicClient = createPublicClient({
        chain: arcTestnet,
        transport: modularTransport,
      });

      const usdcBal = await publicClient.getBalance({ address: state.address });

      setState((s) => ({
        ...s,
        usdcBalance: formatUnits(usdcBal, NATIVE_USDC_DECIMALS),
      }));
    } catch (err) {
      console.error("Balance refresh error:", err);
    }
  }, [state.address]);

  // Auto-login from stored credential
  useEffect(() => {
    const stored = localStorage.getItem("arrow_credential");
    if (stored) {
      try {
        const credential = JSON.parse(stored);
        initAccount(credential);
      } catch {
        localStorage.removeItem("arrow_credential");
      }
    }
  }, [initAccount]);

  return (
    <WalletContext.Provider
      value={{
        ...state,
        register,
        login,
        disconnect,
        refreshBalance,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
