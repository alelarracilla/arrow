import { useState, useEffect, useCallback } from "react";
import styles from "./NewsSection.module.css";
import { NewsCard } from "../NewsCard/NewsCard";
import { SetOrderModal } from "../SetOrderModal/SetOrderModal";
import { TipModal } from "../TipModal/TipModal";
import { getPosts, type Post } from "../../api/client";
import { useWallet } from "../../context/WalletContext";

import c1 from "../../assets/c1.jpg";
import c2 from "../../assets/c2.jpg";
import c3 from "../../assets/c3.jpg";
import c4 from "../../assets/c4.jpg";
import c5 from "../../assets/c5.jpg";

const chartImages = [c1, c2, c3, c4, c5];

export const NewsSection = () => {
  const { address } = useWallet();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderPost, setOrderPost] = useState<Post | null>(null);
  const [tipPost, setTipPost] = useState<Post | null>(null);

  const fetchPosts = useCallback(async () => {
    try {
      setLoading(true);
      const { posts: data } = await getPosts();
      setPosts(data);
    } catch (err) {
      console.error("Failed to fetch posts:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const getPostImage = (postId: string) => {
    const charCodeSum = postId
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);

    const index = charCodeSum % chartImages.length;

    return chartImages[index];
  };

  const isOwnPost = (post: Post) =>
    address?.toLowerCase() === post.address?.toLowerCase();

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString();

  return (
    <div className={styles.newsSection}>
      <h2 className={styles.title}>Latest Posts</h2>

      {loading && posts.length === 0 && (
        <p className={styles.empty}>Loading posts...</p>
      )}

      {!loading && posts.length === 0 && (
        <p className={styles.empty}>
          No posts yet. Be the first to share your analysis!
        </p>
      )}

      {posts.map((post) => (
        <NewsCard
          key={post.id}
          image={getPostImage(post.id)}
          description={post.content}
          pair={post.pair || undefined}
          authorName={post.username || undefined}
          authorAvatar={post.avatar_url || undefined}
          isLeader={!!post.is_leader}
          timestamp={formatDate(post.created_at)}
          buttonText={post.pair && !isOwnPost(post) ? "Set Order" : "Read More"}
          onButtonClick={
            post.pair && !isOwnPost(post) ? () => setOrderPost(post) : undefined
          }
          secondaryButtonText={!isOwnPost(post) ? "Tip" : undefined}
          onSecondaryClick={
            !isOwnPost(post) ? () => setTipPost(post) : undefined
          }
        >
          @{post.username || "anonymous"}
        </NewsCard>
      ))}

      {orderPost && (
        <SetOrderModal post={orderPost} onClose={() => setOrderPost(null)} />
      )}
      {tipPost && <TipModal post={tipPost} onClose={() => setTipPost(null)} />}
    </div>
  );
};
