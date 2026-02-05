import React from 'react';
import styles from './NewsCard.module.css';

interface NewsCardProps {
    children: React.ReactNode;
    image: string;
    description: string;
    buttonText?: string;
    onButtonClick?: () => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({
    children,
    image,
    description,
    buttonText = 'Learn More',
    onButtonClick,
}) => {
    return (
        <div className={styles.newsCard}>
            <img src={image} alt="news" className={styles.newsCardImage} />
            <div className={styles.newsCardContent}>
                <h2 className={styles.newsCardTitle}>
                    {children}
                </h2>
                <p className={styles.newsCardDescription}>{description}</p>
                <button
                    onClick={onButtonClick}
                    className={styles.newsCardButton}
                >
                    {buttonText}
                </button>
            </div>
        </div>
    );
};