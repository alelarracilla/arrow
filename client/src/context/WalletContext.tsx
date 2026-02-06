import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { createPublicClient, formatUnits, type Address } from "viem";
import { polygonAmoy } from "viem/chains";
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

// USDC on Polygon Amoy
const USDC_ADDRESS = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582" as const;
const USDC_DECIMALS = 6;

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface WalletState {
  isConnected: boolean;
  isLoading: boolean;
  address: Address | null;
  nativeBalance: string;
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
    nativeBalance: "0",
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
          `${CLIENT_URL}/polygonAmoy`,
          CLIENT_KEY
        );

        const publicClient = createPublicClient({
          chain: polygonAmoy,
          transport: modularTransport,
        });

        const smartAccount = await toCircleSmartAccount({
          client: publicClient,
          owner: toWebAuthnAccount({ credential }),
        });

        const bundlerClient = createBundlerClient({
          account: smartAccount,
          chain: polygonAmoy,
          transport: modularTransport,
        });

        const address = smartAccount.address;

        // Fetch balances
        const [nativeBal, usdcBal] = await Promise.all([
          publicClient.getBalance({ address }),
          publicClient.readContract({
            address: USDC_ADDRESS,
            abi: ERC20_BALANCE_ABI,
            functionName: "balanceOf",
            args: [address],
          }),
        ]);

        setState({
          isConnected: true,
          isLoading: false,
          address,
          nativeBalance: formatUnits(nativeBal, 18),
          usdcBalance: formatUnits(usdcBal, USDC_DECIMALS),
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
      nativeBalance: "0",
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
        `${CLIENT_URL}/polygonAmoy`,
        CLIENT_KEY
      );
      const publicClient = createPublicClient({
        chain: polygonAmoy,
        transport: modularTransport,
      });

      const [nativeBal, usdcBal] = await Promise.all([
        publicClient.getBalance({ address: state.address }),
        publicClient.readContract({
          address: USDC_ADDRESS,
          abi: ERC20_BALANCE_ABI,
          functionName: "balanceOf",
          args: [state.address],
        }),
      ]);

      setState((s) => ({
        ...s,
        nativeBalance: formatUnits(nativeBal, 18),
        usdcBalance: formatUnits(usdcBal, USDC_DECIMALS),
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
