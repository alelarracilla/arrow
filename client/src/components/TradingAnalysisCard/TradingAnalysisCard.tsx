import styles from './TradingAnalysisCard.module.css';
import { FiTrendingUp } from 'react-icons/fi';

interface TradingAnalysisCardProps {
  chartImageUrl: string;
  avatarUrl?: string;
  cryptoLogoUrl?: string;
}

export const TradingAnalysisCard: React.FC<TradingAnalysisCardProps> = ({ chartImageUrl, avatarUrl, cryptoLogoUrl }) => {
  const analysisData = {
    user: "MoonBoy",
    date: "01/02/2026",
    symbol: "ETH/USDT",
    volume: "3,77 M",
    priceTop: "4.750,00",
    priceBottom: "1.642,73",
    redBoxPrice: "2.127,63",
    redBoxTime: "4d 2h"
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.userInfo}>
          <img src={avatarUrl || "/default-avatar.png"} alt="Avatar" className={styles.miniAvatar} />
          <span className={styles.userName}>{analysisData.user}</span>
        </div>
        <span className={styles.date}>{analysisData.date}</span>
      </div>

      <div className={styles.chartContainer}>
        <div className={styles.chartInfoBar}>
          <span className={styles.volumeText}>Vol. ETH <span className={styles.volumeValue}>{analysisData.volume}</span></span>
        </div>

        <div className={styles.cryptoHeader}>
          <div className={styles.cryptoLeft}>
            <img src={cryptoLogoUrl || "/default-eth-logo.png"} alt="ETH Logo" className={styles.cryptoLogo} />
            <span className={styles.cryptoSymbol}>{analysisData.symbol}</span>
          </div>
          <div className={styles.trendingBadge}>
            <FiTrendingUp className={styles.trendingIcon} />
          </div>
        </div>

        <div className={styles.chartWrapper}>
          <img src={chartImageUrl} alt="Trading Chart" className={styles.chartImage} />

          <div className={styles.priceOverlayTop}>{analysisData.priceTop}</div>
        </div>
      </div>
    </div>
  );
};