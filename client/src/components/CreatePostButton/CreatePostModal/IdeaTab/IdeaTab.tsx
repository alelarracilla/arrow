import { useState } from 'react';
import styles from '../PostTypes.module.css';
import { FiChevronDown, FiImage } from 'react-icons/fi';

export const IdeaTab = () => {
  const [side, setSide] = useState('buy');

  return (
    <div className={styles.wrapper}>
      <div className={styles.userInfo}>
        <img src="/avatar-placeholder.png" alt="User" className={styles.avatar} />
        <button className={styles.audienceBtn}>
          Everyone <FiChevronDown />
        </button>
      </div>

      <div className={styles.formSection}>
        <label className={styles.label}>Set limit order</label>
        
        <div className={styles.cardDark}>
          <div className={styles.row}>
            <span className={styles.inputLabel}>Pair:</span>
            <div className={styles.pairSelector}>
              <img src="https://cryptologos.cc/logos/ethereum-eth-logo.png" width={16} alt="" />
              ETH/USDT <FiChevronDown />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.inputLabel}>Price:</span>
            <input type="number" placeholder="0.00" className={styles.priceInput} />
          </div>

          <div className={styles.tradeButtons}>
            <button 
              className={`${styles.tradeBtn} ${side === 'buy' ? styles.btnGreen : ''}`}
              onClick={() => setSide('buy')}
            >
              Buy
            </button>
            <button 
              className={`${styles.tradeBtn} ${side === 'sell' ? styles.btnRed : ''}`}
              onClick={() => setSide('sell')}
            >
              Sell
            </button>
          </div>
        </div>
      </div>

      <div className={styles.formSection}>
        <label className={styles.label}>Add a description</label>
        <textarea 
          className={styles.textAreaSmall} 
          placeholder="Trade description goes here" 
        />
      </div>

      <div className={styles.formSection}>
        <label className={styles.label}>Attach Analysis</label>
        <div className={styles.uploadBox}>
          <FiImage size={24} color="#8b949e" />
          <p>Select analysis to upload</p>
          <span>JPEG up to 8MB</span>
          <div className={styles.uploadBar}></div>
        </div>
      </div>
    </div>
  );
};