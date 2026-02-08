import React from "react";
import { NavLink } from "react-router-dom"; // 1. Importar NavLink
import styles from "./NavBar.module.css";
import { HiOutlineBookmark, HiOutlineUserCircle, HiOutlineWallet } from "react-icons/hi2";
import logo from "../../assets/logo.svg";

const NavBar: React.FC = () => {
  
  // Función auxiliar para combinar clases si está activo
  const linkClassName = ({ isActive }: { isActive: boolean }) => 
    isActive ? `${styles.navItem} ${styles.active}` : styles.navItem;

  return (
    <nav className={styles.navbar}>
      {/* Home */}
      <NavLink to="/" className={linkClassName}>
        <img src={logo} alt="Arrow Logo" className={styles.logo} />
        Home
      </NavLink>

      {/* Watchlist */}
      <NavLink to="/watchlist" className={linkClassName}>
        <HiOutlineBookmark size={24}/>
        Watchlist
      </NavLink>

      {/* Profile */}
      <NavLink to="/profile" className={linkClassName}>
        <HiOutlineUserCircle size={24}/>
        Profile
      </NavLink>

      {/* Assets */}
      <NavLink to="/assets" className={linkClassName}>
        <HiOutlineWallet size={24}/>
        Assets
      </NavLink>
    </nav>
  );
};

export default NavBar;