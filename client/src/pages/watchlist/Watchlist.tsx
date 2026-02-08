import React, { useState } from "react";
import styles from "./Watchlist.module.css";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  price: string;
  changeValue: string;
  changePercent: string;
  isPositive: boolean;
  iconColor: string;
}

const mockData: Asset[] = [
  {
    id: "1",
    symbol: "ETHUSDT",
    name: "ETH",
    price: "2,097.69",
    changeValue: "+34.31",
    changePercent: "+1.66%",
    isPositive: true,
    iconColor: "#627eea",
  },
  {
    id: "2",
    symbol: "UNIUSDT",
    name: "UNI",
    price: "3.562",
    changeValue: "+0.01",
    changePercent: "+0.28%",
    isPositive: true,
    iconColor: "#ff007a",
  },
  {
    id: "3",
    symbol: "PEPEUSDT",
    name: "PEPE",
    price: "0.000003890",
    changeValue: "-0.00",
    changePercent: "-0.59%",
    isPositive: false,
    iconColor: "#4c9540",
  },
  {
    id: "4",
    symbol: "ZAMAUSDT",
    name: "ZAMA",
    price: "0.02981",
    changeValue: "+0.00",
    changePercent: "+1.95%",
    isPositive: true,
    iconColor: "#00b4c9",
  },
];

const Watchlist: React.FC = () => {
  const [timeframe, setTimeframe] = useState("1Y");

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>My Watchlist</h1>

      <div className={styles.chartCard}>
        <div className={styles.chartCanvas}>
          <svg
            className={styles.chartLineSvg}
            viewBox="0 0 300 100"
            preserveAspectRatio="none"
          >
            <path
              d="M0,80 C20,70 40,90 60,60 C80,30 100,50 120,20 C140,5 160,25 180,15 C200,35 220,60 240,50 C260,40 280,60 300,80"
              fill="none"
              stroke="#2962ff"
              strokeWidth="2"
            />
          </svg>
        </div>

        <div className={styles.timeControls}>
          {["1D", "1M", "3M", "1Y", "5Y", "All"].map((time) => (
            <button
              key={time}
              className={`${styles.timeBtn} ${timeframe === time ? styles.active : ""}`}
              onClick={() => setTimeframe(time)}
            >
              {time}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.assetList}>
        {mockData.map((asset) => (
          <div key={asset.id} className={styles.assetRow}>
            <div className={styles.leftInfo}>
              <div
                className={styles.iconPlaceholder}
                style={{ background: asset.iconColor }}
              >
                {asset.name[0]}
                <div className={styles.subIcon}></div>
              </div>
              <div className={styles.tickerInfo}>
                <span className={styles.symbol}>{asset.symbol}</span>
                <span className={styles.name}>{asset.name}</span>
              </div>
            </div>

            <div className={styles.rightInfo}>
              <span className={styles.price}>{asset.price}</span>
              <div
                className={`${styles.changeBlock} ${asset.isPositive ? styles.positive : styles.negative}`}
              >
                <span>{asset.changeValue}</span>
                <span>{asset.changePercent}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Watchlist;
