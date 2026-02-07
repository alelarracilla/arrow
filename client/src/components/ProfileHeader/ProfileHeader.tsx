import styles from './ProfileHeader.module.css';
import profileImg from '../../assets/profile.png';

export const ProfileHeader = () => {
  const profileData = {
    name: "MoonBoy",
    username: "MoonBoy.eth",
    followers: "12k",
    ideas: "1.2k",
    following: "1k",
    bio: "Love Crypto Space, be part of the best trading club.",
    avatarUrl: "/path-to-your-avatar.png"
  };

  return (
    <div className={styles.container}>
      <div className={styles.topSection}>
        <div className={styles.avatarWrapper}>
          <img src={profileImg} alt="Avatar" className={styles.avatar} />
          <div className={styles.ensBadge}>
            <span className={styles.ensIcon}>◇</span> {profileData.username}
          </div>
        </div>

        <div className={styles.infoSection}>
          <div className={styles.headerRow}>
            <h2 className={styles.name}>{profileData.name}</h2>
            <span className={styles.verifiedBadge}>✓</span>
          </div>

          <div className={styles.statsContainer}>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>{profileData.followers}</span>
              <span className={styles.statLabel}>Followers</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>{profileData.ideas}</span>
              <span className={styles.statLabel}>Ideas</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statNumber}>{profileData.following}</span>
              <span className={styles.statLabel}>Following</span>
            </div>
          </div>

          <p className={styles.bio}>{profileData.bio}</p>
        </div>
      </div>

      <div className={styles.buttonGroup}>
        <button className={styles.btnPrimary}>Edit profile</button>
        <button className={styles.btnPrimary}>Share profile</button>
      </div>
    </div>
  );
};