import React, { useState } from 'react';
import { HiMiniCog8Tooth } from "react-icons/hi2";
import { HiMagnifyingGlass } from "react-icons/hi2";
import styles from './SearchBar.module.css';

interface SearchBarProps {
    onSearch?: (query: string) => void;
    onFilterClick?: () => void;
    placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
    onSearch,
    onFilterClick,
    placeholder = 'Search',
}) => {
    const [query, setQuery] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        onSearch?.(e.target.value);
    };

    return (
        <div className={styles.searchBar}>
            <div className={styles.searchInputContainer}>
                <HiMagnifyingGlass size={20} className={styles.searchIcon} />
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder={placeholder}
                    value={query}
                    onChange={handleChange}
                />
            </div>
            <button className={styles.filterButton} onClick={onFilterClick}>
                <HiMiniCog8Tooth size={20} />
            </button>
        </div>
    );
};