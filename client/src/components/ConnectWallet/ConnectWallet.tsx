import { useState, useRef, useEffect } from "react";
import { useWallet } from "../../context/WalletContext";
import styles from "./ConnectWallet.module.css";

export function ConnectWallet() {
  const { isConnected, isLoading, address, usdcBalance, error, register, login, disconnect } = useWallet();
  const [showMenu, setShowMenu] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [username, setUsername] = useState("");
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowRegister(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Connecting...</div>
      </div>
    );
  }

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isConnected && address) {
    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className={styles.container} ref={menuRef}>
        <button className={styles.connectedBtn} onClick={() => setShowMenu(!showMenu)}>
          {shortAddr}
        </button>

        {showMenu && (
          <div className={styles.dropdown}>
            <div className={styles.walletInfo}>
              <span className={styles.walletLabel}>Wallet</span>
              <button className={styles.copyBtn} onClick={copyAddress}>
                {copied ? "Copied!" : address}
              </button>
            </div>
            <div className={styles.balanceRow}>
              <span className={styles.balanceLabel}>USDC</span>
              <span className={styles.usdc}>{parseFloat(usdcBalance).toFixed(2)}</span>
            </div>
            <button className={styles.disconnectBtn} onClick={() => { disconnect(); setShowMenu(false); }}>
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container} ref={menuRef}>
      <button className={styles.connectBtn} onClick={() => setShowMenu(!showMenu)}>
        Connect
      </button>

      {showMenu && (
        <div className={styles.dropdown}>
          {error && <div className={styles.error}>{error}</div>}

          {showRegister ? (
            <>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={styles.input}
                autoFocus
              />
              <button
                className={styles.dropdownBtn}
                onClick={() => {
                  if (username.trim()) {
                    register(username.trim());
                    setShowMenu(false);
                  }
                }}
                disabled={!username.trim()}
              >
                Create Wallet
              </button>
              <button className={styles.switchBtn} onClick={() => setShowRegister(false)}>
                ← Back to Login
              </button>
            </>
          ) : (
            <>
              <button className={styles.dropdownBtn} onClick={() => { login(); setShowMenu(false); }}>
                Login with Passkey
              </button>
              <button className={styles.dropdownBtn} onClick={() => setShowRegister(true)}>
                Register New Wallet
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
