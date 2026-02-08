import React from "react";
import styles from "./Assets.module.css";
import {
  HiOutlinePaperAirplane,
  HiOutlineArrowsRightLeft,
  HiOutlineArrowDown,
  HiOutlinePlus,
  HiOutlineEye,
  HiArrowRight,
} from "react-icons/hi2";
import { FaEthereum } from "react-icons/fa";

const Assets: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.headerSection}>
        <div className={styles.label}>
          Est. Total Assets <HiOutlineEye />
        </div>
        <h1 className={styles.totalBalance}>$2,500.00</h1>
        <div className={styles.pnl}>
          Today's P&L +750 USD (1%) <HiArrowRight size={12} />
        </div>
      </div>

      <div className={styles.actionButtons}>
        <ActionButton icon={<HiOutlinePaperAirplane />} label="Send" />
        <ActionButton icon={<HiOutlineArrowsRightLeft />} label="Swap" />
        <ActionButton icon={<HiOutlineArrowDown />} label="Deposit" />
        <ActionButton icon={<HiOutlinePlus />} label="Buy" />
      </div>

      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Tips & Suscriptions Flow</span>
          <a href="#" className={styles.viewAll}>
            View all <HiArrowRight />
          </a>
        </div>

        <div className={styles.barChartContainer}>
          <div className={styles.yAxis}>
            <span className={styles.yLabel}>3.0k$</span>
            <span className={styles.yLabel}>2.5k$</span>
            <span className={styles.yLabel}>2.0k$</span>
            <span className={styles.yLabel}>1.5k$</span>
            <span className={styles.yLabel}>1.0k$</span>
            <span className={styles.yLabel}>0.0$</span>
          </div>

          <div className={styles.barsWrapper}>
            <div className={styles.barColumn}>
              <div
                className={`${styles.bar} ${styles.barSolid}`}
                style={{ height: "140px" }} // Altura simulada
              ></div>
              <span className={styles.barLabel}>Nov</span>
            </div>

            <div className={styles.barColumn}>
              <div
                className={`${styles.bar} ${styles.barStriped}`}
                style={{ height: "110px" }}
              ></div>
              <span className={styles.barLabel}>Dec</span>
            </div>

            <div className={styles.barColumn}>
              <div
                className={`${styles.bar} ${styles.barStriped}`}
                style={{ height: "160px" }}
              ></div>
              <span className={styles.barLabel}>Jan</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>Allocation</span>
        </div>

        <div className={styles.donutContainer}>
          <div className={styles.donutChart}>
            <div className={styles.donutHole}>
              <span className={styles.centerLabel}>ETH</span>
              <span className={styles.centerValue}>$1,165.00</span>
            </div>
          </div>
        </div>

        <div className={styles.allocationList}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              color: "#848e9c",
              fontSize: "10px",
              paddingBottom: "4px",
            }}
          >
            <span style={{ width: "30%" }}>Asset</span>
            <span style={{ width: "30%" }}>Holdings</span>
            <span style={{ width: "35%", textAlign: "right" }}>Allocation</span>
          </div>

          <AllocationRow
            symbol="ETH"
            color="#5b8bf9"
            value="$1,165.00"
            amount="0.5 ETH"
            percent="46.6%"
          />
          <AllocationRow
            symbol="ZAMA"
            color="#fcdc2e"
            value="$665.00"
            amount="21,661.23"
            percent="26.6%"
          />
          <AllocationRow
            symbol="UNI"
            color="#ff007a"
            value="$665.00"
            amount="2,375"
            percent="26.6%"
          />
        </div>
      </div>
    </div>
  );
};

const ActionButton = ({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) => (
  <div className={styles.actionBtnWrapper}>
    <button className={styles.circleBtn}>{icon}</button>
    <span className={styles.btnLabel}>{label}</span>
  </div>
);

interface AllocationRowProps {
  symbol: string;
  color: string;
  value: string;
  amount: string;
  percent: string;
}

const AllocationRow = ({
  symbol,
  color,
  value,
  amount,
  percent,
}: AllocationRowProps) => (
  <div className={styles.allocationRow}>
    <div className={styles.assetInfo}>
      <div
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          backgroundColor: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "10px",
          color: "#000",
          fontWeight: "bold",
        }}
      >
        <FaEthereum style={{ color: "white" }} />
      </div>
      <span className={styles.assetName}>{symbol}</span>
    </div>
    <div className={styles.holdingsInfo}>
      <span className={styles.holdingsValue}>{value}</span>
      <span className={styles.holdingsAmount}>{amount}</span>
    </div>
    <div className={styles.allocationBarContainer}>
      <span className={styles.percentText}>{percent}</span>
      <div className={styles.progressBarBg}>
        <div
          className={styles.progressBarFill}
          style={{ width: percent, backgroundColor: color }}
        ></div>
      </div>
    </div>
  </div>
);

export default Assets;
