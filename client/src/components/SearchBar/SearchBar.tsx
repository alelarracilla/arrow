import React, { useState } from "react";
import { HiBars3 } from "react-icons/hi2";
import { HiMiniMagnifyingGlass } from "react-icons/hi2";
import arrowImg from "../../assets/arrow.svg";
import { ConnectWallet } from "../ConnectWallet/ConnectWallet";
import styles from "./SearchBar.module.css";
import { SearchModal } from "../SearchModal/SearchModal";

interface SearchBarProps {
  onSearch?: (query: string) => void;
  onFilterClick?: () => void;
  onMenuClick?: () => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({ onMenuClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleSearch = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      <div className={styles.navContainer}>
        <button className={styles.iconButton} onClick={onMenuClick}>
          <HiBars3 size={24} />
        </button>

        <div className={styles.centerSection}>
          <img src={arrowImg} alt="Arrow Logo" className={styles.logo} />
          <button className={styles.searchCircle} onClick={toggleSearch}>
            <HiMiniMagnifyingGlass size={20} />
          </button>
        </div>

        <ConnectWallet />
      </div>
      {isExpanded && <SearchModal onClose={toggleSearch} />}
    </>
  );
};
