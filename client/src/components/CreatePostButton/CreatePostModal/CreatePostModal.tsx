import { useState } from "react";
import styles from "./CreatePostModal.module.css";
import { PostTab } from "./PostTab";
import { IdeaTab } from "./IdeaTab";

interface CreatePostModalProps {
  onClose: () => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState("post");

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <div className={styles.header}>
          <button onClick={onClose} className={styles.cancelBtn}>
            Cancel
          </button>

          <div className={styles.tabs}>
            <button
              className={activeTab === "post" ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab("post")}
            >
              Post
            </button>
            <button
              className={activeTab === "idea" ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab("idea")}
            >
              Idea
            </button>
          </div>

          <button className={styles.postBtn}>Post</button>
        </div>

        <div className={styles.content}>
          {activeTab === "post" ? <PostTab /> : <IdeaTab />}
        </div>
      </div>
    </div>
  );
};
