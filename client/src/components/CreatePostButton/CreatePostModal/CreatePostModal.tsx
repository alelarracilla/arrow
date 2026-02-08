import { useState } from "react";
import styles from "./CreatePostModal.module.css";
import { PostTab, type PostData } from "./PostTab";
import { IdeaTab, type IdeaData } from "./IdeaTab";
import { createPost } from "../../../api/client";

interface CreatePostModalProps {
  onClose: () => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState("post");
  const [data, setData] = useState<Partial<PostData & IdeaData>>({});
  
  const setPostData = (postData: PostData) => setData(postData as Partial<PostData & IdeaData>);
  const setIdeaData = (ideaData: IdeaData) => setData(ideaData as Partial<PostData & IdeaData>);
  
  const handlePost = () => {
    if (data.content) {
      createPost({
        ...data,
        content: data.content,
      }).then(() => {
          setData({});
      });
      onClose();
    }
  }

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

          <button className={styles.postBtn} onClick={handlePost}>Post</button>
        </div>

        <div className={styles.content}>
          {activeTab === "post" ? <PostTab data={data as PostData} setData={setPostData}/> : <IdeaTab data={data as IdeaData} setData={setIdeaData}/>}
        </div>
      </div>
    </div>
  );
};
