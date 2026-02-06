import { useState } from "react";
import { useWallet } from "../../context/WalletContext";
import styles from "./ConnectWallet.module.css";

export function ConnectWallet() {
  const { isConnected, isLoading, address, usdcBalance, nativeBalance, error, register, login, disconnect } = useWallet();
  const [showRegister, setShowRegister] = useState(false);
  const [username, setUsername] = useState("");

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Connecting...</div>
      </div>
    );
  }

  if (isConnected && address) {
    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className={styles.container}>
        <div className={styles.connected}>
          <div className={styles.balances}>
            <span className={styles.usdc}>{parseFloat(usdcBalance).toFixed(2)} USDC</span>
            <span className={styles.native}>{parseFloat(nativeBalance).toFixed(4)} POL</span>
          </div>
          <button className={styles.addressBtn} onClick={disconnect} title="Disconnect">
            {shortAddr}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {error && <div className={styles.error}>{error}</div>}

      {showRegister ? (
        <div className={styles.registerForm}>
          <input
            type="text"
            placeholder="Choose a username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={styles.input}
            autoFocus
          />
          <button
            className={styles.connectBtn}
            onClick={() => username.trim() && register(username.trim())}
            disabled={!username.trim()}
          >
            Create Wallet
          </button>
          <button className={styles.switchBtn} onClick={() => setShowRegister(false)}>
            Already have a wallet? Login
          </button>
        </div>
      ) : (
        <div className={styles.authButtons}>
          <button className={styles.connectBtn} onClick={login}>
            Connect Wallet
          </button>
          <button className={styles.switchBtn} onClick={() => setShowRegister(true)}>
            New? Register
          </button>
        </div>
      )}
    </div>
  );
}
