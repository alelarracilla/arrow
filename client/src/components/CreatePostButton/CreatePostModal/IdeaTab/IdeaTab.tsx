import { useRef, type ChangeEvent } from "react";
import styles from "../PostTypes.module.css";
import { FiChevronDown, FiImage, FiCheckCircle } from "react-icons/fi";

export interface IdeaData {
  content: string;
  image_url?: string;
  pair?: string;
  pair_address_0?: string;
  pair_address_1?: string;
  pool_fee?: number;
  is_premium?: boolean;
  price?: number;
  side?: "buy" | "sell";
}

interface IdeaTabProps {
  setData: (data: IdeaData) => void;
  data: IdeaData;
}

export const IdeaTab: React.FC<IdeaTabProps> = ({ data, setData }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateField = <K extends keyof IdeaData>(field: K, value: IdeaData[K]) => {
    setData({
      ...data,
      [field]: value,
      ...(field === "pair" && {
        pair: "ETH/USDT",
        pair_address_0: "0xAddress0...",
        pair_address_1: "0xAddress1...",
        pool_fee: 3000, // 0.3%
      }),
    });
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      updateField("image_url", objectUrl);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.userInfo}>
        <img
          src="/avatar-placeholder.png"
          alt="User"
          className={styles.avatar}
        />
        <button className={styles.audienceBtn}>
          Everyone <FiChevronDown />
        </button>

        <div 
          className={styles.premiumToggle} 
          onClick={() => updateField("is_premium", !data.is_premium)}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 12, color: data.is_premium ? '#00ff88' : '#8b949e' }}
        >
          {data.is_premium ? <FiCheckCircle /> : <div style={{width: 14, height: 14, border: '1px solid #8b949e', borderRadius: '50%'}} />}
          Premium
        </div>
      </div>

      <div className={styles.formSection}>
        <label className={styles.label}>Set limit order</label>

        <div className={styles.cardDark}>
          <div className={styles.row}>
            <span className={styles.inputLabel}>Pair:</span>
            <div 
              className={styles.pairSelector}
              onClick={() => updateField("pair", "ETH/USDT")} 
            >
              <img
                src="https://cryptologos.cc/logos/ethereum-eth-logo.png"
                width={16}
                alt=""
              />
              {data.pair || "ETH/USDT"} <FiChevronDown />
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.inputLabel}>Price:</span>
            <input
              type="number"
              placeholder="0.00"
              className={styles.priceInput}
              value={data.price || ""}
              onChange={(e) => updateField("price", parseFloat(e.target.value))}
            />
          </div>

          <div className={styles.tradeButtons}>
            <button
              className={`${styles.tradeBtn} ${
                data.side === "buy" ? styles.btnGreen : ""
              }`}
              onClick={() => updateField("side", "buy")}
            >
              Buy
            </button>
            <button
              className={`${styles.tradeBtn} ${
                data.side === "sell" ? styles.btnRed : ""
              }`}
              onClick={() => updateField("side", "sell")}
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
          value={data.content || ""}
          onChange={(e) => updateField("content", e.target.value)}
        />
      </div>

      <div className={styles.formSection}>
        <label className={styles.label}>Attach Analysis</label>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/jpeg, image/png"
          onChange={handleImageUpload}
        />

        <div 
          className={styles.uploadBox}
          onClick={() => fileInputRef.current?.click()}
          style={data.image_url ? { borderColor: '#00ff88' } : {}}
        >
          {data.image_url ? (

            <div style={{width: '100%', height: 100, overflow: 'hidden', borderRadius: 8}}>
                 <img src={data.image_url} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
            </div>
          ) : (
            <>
              <FiImage size={24} color="#8b949e" />
              <p>Select analysis to upload</p>
              <span>JPEG up to 8MB</span>
              <div className={styles.uploadBar}></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};