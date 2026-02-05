import React, { useState } from 'react';
import styles from './FollowSuggestion.module.css';

interface FollowSuggestionProps {
    id: string;
    name: string;
    profilePhoto: string;
    onFollow: (id: string) => void;
}

export const FollowSuggestion: React.FC<FollowSuggestionProps> = ({
    id,
    name,
    profilePhoto,
    onFollow,
}) => {
    const [isFollowing, setIsFollowing] = useState(false);

    const handleFollow = () => {
        setIsFollowing(!isFollowing);
        onFollow(id);
    };

    return (
        <div className={styles.container}>
            <img
                src={profilePhoto}
                alt={name}
                className={styles.profilePhoto}
            />
            <h3 className={styles.name}>{name}</h3>
            <button
                onClick={handleFollow}
                className={`${styles.button} ${
                    isFollowing ? styles.buttonFollowing : styles.buttonFollow
                }`}
            >
                {isFollowing ? 'Following' : 'Follow'}
            </button>
        </div>
    );
};