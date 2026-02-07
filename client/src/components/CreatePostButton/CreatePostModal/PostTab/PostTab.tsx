import styles from '../PostTypes.module.css';
import { FiImage, FiCamera, FiChevronDown } from 'react-icons/fi';

export const PostTab = () => {
  return (
    <div className={styles.wrapper}>
      <div className={styles.userInfo}>
        <img src="/avatar-placeholder.png" alt="User" className={styles.avatar} />
        <button className={styles.audienceBtn}>
          Everyone <FiChevronDown />
        </button>
      </div>

      <textarea 
        className={styles.textArea} 
        placeholder="What's on your trading mind?" 
        autoFocus
      />

      <div className={styles.footerActions}>
        <FiImage className={styles.actionIcon} />
        <FiCamera className={styles.actionIcon} />
      </div>
    </div>
  );
};