import React from 'react';
import styles from './NewsCard.module.css';

interface NewsCardProps {
    children: React.ReactNode;
    image: string;
    description: string;
    buttonText?: string;
    onButtonClick?: () => void;
    pair?: string;
    authorName?: string;
    authorAvatar?: string;
    isLeader?: boolean;
    timestamp?: string;
    secondaryButtonText?: string;
    onSecondaryClick?: () => void;
}

export const NewsCard: React.FC<NewsCardProps> = ({
    children,
    image,
    description,
    buttonText = 'Learn More',
    onButtonClick,
    pair,
    authorName,
    authorAvatar,
    isLeader,
    timestamp,
    secondaryButtonText,
    onSecondaryClick,
}) => {
    return (
        <div className={styles.newsCard}>
            {(pair || authorName) && (
                <div className={styles.newsCardHeader}>
                    <div className={styles.newsCardPair}>
                        {pair && <span className={styles.pairLabel}>{pair}</span>}
                        {pair && <span className={styles.pairIcon}>↗</span>}
                    </div>
                    {authorName && (
                        <div className={styles.authorInfo}>
                            {authorAvatar ? (
                                <img src={authorAvatar} alt={authorName} className={styles.authorAvatar} />
                            ) : (
                                <div className={styles.authorAvatarFallback}>
                                    {authorName[0].toUpperCase()}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            <img src={image} alt="news" className={styles.newsCardImage} />
            <div className={styles.newsCardContent}>
                <h2 className={styles.newsCardTitle}>
                    {children}
                    {isLeader && <span className={styles.leaderBadge}>Leader</span>}
                </h2>
                {timestamp && <span className={styles.newsCardTime}>{timestamp}</span>}
                <p className={styles.newsCardDescription}>{description}</p>
                <div className={styles.newsCardActions}>
                    {onSecondaryClick && secondaryButtonText && (
                        <button
                            onClick={onSecondaryClick}
                            className={styles.newsCardSecondaryButton}
                        >
                            {secondaryButtonText}
                        </button>
                    )}
                    <button
                        onClick={onButtonClick}
                        className={styles.newsCardButton}
                    >
                        {buttonText}
                    </button>
                </div>
            </div>
        </div>
    );
};