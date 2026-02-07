import styles from './PostCard.module.css';
import profileImg from '../../assets/profile.png';
import { FiSettings, FiBarChart2, FiMessageCircle, FiHeart, FiShare } from 'react-icons/fi';

export const PostCard = () => {
  const postData = {
    user: "MoonBoy",
    date: "01/02/2026",
    content: "Happy to announce that my community is now open, subscription costs 10 USDC and you will have access to exclusive analysis",
    avatarUrl: profileImg 
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.userInfo}>
          <img src={postData.avatarUrl} alt="Avatar" className={styles.miniAvatar} />
          <span className={styles.userName}>{postData.user}</span>
        </div>
        <span className={styles.date}>{postData.date}</span>
      </div>

      <div className={styles.content}>
        <p>{postData.content}</p>
      </div>

      <div className={styles.footer}>
        <div className={styles.leftIcons}>
          <FiSettings className={styles.icon} />
          <FiBarChart2 className={styles.icon} />
        </div>
        <div className={styles.rightIcons}>
          <FiMessageCircle className={styles.icon} />
          <FiHeart className={styles.icon} />
          <FiShare className={styles.icon} />
        </div>
      </div>
    </div>
  );
};