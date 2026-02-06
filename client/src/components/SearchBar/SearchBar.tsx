import React, { useState } from 'react';
import { HiBars3 } from "react-icons/hi2";
import { HiMiniMagnifyingGlass } from "react-icons/hi2";
import arrowImg from '../../assets/arrow.svg';

import styles from './SearchBar.module.css';

interface SearchBarProps {
    onSearch?: (query: string) => void;
    onFilterClick?: () => void;
    onMenuClick?: () => void;
    placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    onSearch,
    onFilterClick,
    onMenuClick,
    placeholder = 'Search...',
}) => {
    const [query, setQuery] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        onSearch?.(e.target.value);
    };

    const toggleSearch = () => {
        setIsExpanded(!isExpanded);
    };

    return (
        <div className={styles.navContainer}>
            {/* 1. Lado Izquierdo: Hamburger Icon */}
            <button className={styles.iconButton} onClick={onMenuClick}>
                <HiBars3 size={24} />
            </button>

            {/* 2. Centro: Logo o Input Expandido */}
            <div className={styles.centerSection}>
                {!isExpanded ? (
                    <>
                        <img src={arrowImg} alt="Arrow Logo" className={styles.logo} />
                        <button className={styles.searchCircle} onClick={toggleSearch}>
                            <HiMiniMagnifyingGlass size={20} /> 
                        </button>
                    </>
                ) : (
                    <div className={styles.expandedSearch}>
                        <input
                            autoFocus
                            type="text"
                            className={styles.searchInput}
                            placeholder={placeholder}
                            value={query}
                            onChange={handleChange}
                            onBlur={() => query === '' && setIsExpanded(false)} // Opcional: se cierra si está vacío al perder foco
                        />
                        <button onClick={toggleSearch} className={styles.closeSearch}>✕</button>
                    </div>
                )}
            </div>

            {/* 3. Lado Derecho: Botón de Configuración */}
            <button className={styles.filterButton} onClick={onFilterClick}>
                Connect
            </button>
        </div>
    );
};