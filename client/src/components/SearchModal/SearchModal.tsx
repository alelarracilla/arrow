import styles from './SearchModal.module.css';
import { FiSearch, FiX, FiPieChart, FiUser, FiLayers } from 'react-icons/fi';

interface SearchModalProps {
  onClose: () => void;
}

export const SearchModal: React.FC<SearchModalProps> = ({ onClose }) => {
  const tokens = [
    { name: 'ETH/USDC', price: '2103.76', change: '-0.39', percent: '-0.18%', up: false, icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png' },
    { name: 'ZAMA/USDT', price: '0.0307', change: '+0.3', percent: '+9.78%', up: true, icon: 'https://zama.ai/favicon.ico' },
    { name: 'UNI/USDC', price: '0.28', change: '+0.2', percent: '+8.02%', up: true, icon: 'https://cryptologos.cc/logos/uniswap-uni-logo.png' },
  ];

  return (
    <div className={styles.overlay}>
      <div className={styles.header}>
        <div className={styles.inputWrapper}>
          <FiSearch className={styles.searchIcon} />
          <input type="text" placeholder="Search in ArrowTc" autoFocus />
        </div>
        <button className={styles.closeBtn} onClick={onClose}>
          <FiX size={28} />
        </button>
      </div>

      <div className={styles.tabs}>
        <button className={styles.tabActive}><FiPieChart /> All</button>
        <button className={styles.tab}><FiLayers /> Tokens</button>
        <button className={styles.tab}><FiUser /> Profile</button>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Tokens</h3>
        <div className={styles.list}>
          {tokens.map((token, i) => (
            <div key={i} className={styles.item}>
              <div className={styles.itemLeft}>
                <img src={token.icon} alt="" className={styles.tokenIcon} />
                <span className={styles.itemName}>{token.name}</span>
              </div>
              <div className={styles.itemRight}>
                <span className={styles.price}>{token.price}</span>
                <span className={token.up ? styles.green : styles.red}>{token.change}</span>
                <span className={token.up ? styles.green : styles.red}>{token.percent}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Profiles</h3>
      </div>
    </div>
  );
};