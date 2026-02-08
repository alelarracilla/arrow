import React from "react";
import styles from "./PostCard.module.css";
import profilePlaceholder from "../../assets/profile.png"; // Imagen por defecto
import {
  FiSettings,
  FiBarChart2,
  FiMessageCircle,
  FiHeart,
  FiShare,
} from "react-icons/fi";

interface PostCardProps {
  authorName: string;
  authorAvatar?: string;
  date: string;
  content: string;
  postImage?: string;
  onSetOrder?: () => void;
  onTip?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  authorName,
  authorAvatar,
  date,
  content,
  postImage,
  onSetOrder,
  onTip,
}) => {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.userInfo}>
          <img
            src={authorAvatar || profilePlaceholder}
            alt="Avatar"
            className={styles.miniAvatar}
            onError={(e) => {
              (e.target as HTMLImageElement).src = profilePlaceholder;
            }}
          />
          <span className={styles.userName}>{authorName}</span>
        </div>
        <span className={styles.date}>{date}</span>
      </div>

      <div className={styles.content}>
        <p>{content}</p>

        {postImage && (
          <img
            src={postImage}
            alt="Analysis Chart"
            style={{
              width: "100%",
              marginTop: "10px",
              borderRadius: "8px",
              objectFit: "cover",
            }}
          />
        )}
      </div>

      <div className={styles.footer}>
        <div className={styles.leftIcons}>
          <div onClick={onSetOrder} style={{ cursor: "pointer" }}>
            <FiSettings className={styles.icon} />
          </div>

          <div onClick={onTip} style={{ cursor: "pointer" }}>
            <FiBarChart2 className={styles.icon} />
          </div>
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
