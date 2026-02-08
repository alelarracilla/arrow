import React, {type ChangeEvent } from "react";
import styles from "../PostTypes.module.css";
import { FiImage, FiCamera, FiChevronDown } from "react-icons/fi";

export interface PostData {
  content: string;
  [key: string]: string | number | boolean; 
}

interface PostTabProps {
  setData: (data: PostData) => void;
  data: PostData;
}

export const PostTab: React.FC<PostTabProps> = ({ data, setData }) => {
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setData({
      ...data,
      content: e.target.value,
    });
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.userInfo}>
        <img
          src="/avatar-placeholder.png"
          alt="User"
          className={styles.avatar}
        />
        <button className={styles.audienceBtn}>
          Everyone <FiChevronDown />
        </button>
      </div>

      <textarea
        className={styles.textArea}
        placeholder="What's on your trading mind?"
        autoFocus
        value={data.content || ""} 
        onChange={handleChange}
      />

      <div className={styles.footerActions}>
        <FiImage className={styles.actionIcon} />
        <FiCamera className={styles.actionIcon} />
      </div>
    </div>
  );
};