import React from "react";
import styles from "./NavBar.module.css";
import { HiOutlineBookmark } from "react-icons/hi2";
import { HiOutlineUserCircle } from "react-icons/hi2";
import { HiOutlineWallet } from "react-icons/hi2";
import logo from "../../assets/logo.svg";

const NavBar: React.FC = () => {
  return (
    <nav className={styles.navbar}>
      <a href="/" className={styles.navItem}>
        <img src={logo} alt="Arrow Logo" className={styles.logo} />
        Home
      </a>
      <a href="/watchlist" className={styles.navItem}>
        <HiOutlineBookmark size={24}/>
        Watchlist
      </a>
      <a href="/profile" className={styles.navItem}>
        <HiOutlineUserCircle size={24}/>
        Profile
      </a>
      <a href="/assets" className={styles.navItem}>
        <HiOutlineWallet size={24}/>
        Assets
      </a>
    </nav>
  );
};

export default NavBar;
