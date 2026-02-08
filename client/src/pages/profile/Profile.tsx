import React, { useState, useEffect, useCallback } from "react";
import { PostCard } from "../../components/PostCard/PostCard";
import { ProfileHeader } from "../../components/ProfileHeader/ProfileHeader";
import { SetOrderModal } from "../../components/SetOrderModal/SetOrderModal";
import { TipModal } from "../../components/TipModal/TipModal";

import { useWallet } from "../../context/WalletContext";
import { getPosts, type Post } from "../../api/client";

import c1 from "../../assets/c1.jpg";
import c2 from "../../assets/c2.jpg";
import c3 from "../../assets/c3.jpg";
import c4 from "../../assets/c4.jpg";
import c5 from "../../assets/c5.jpg";
import { useAuth } from "../../context/AuthContext";

const chartImages = [c1, c2, c3, c4, c5];

export const Profile = () => {
  const { address } = useWallet();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const [orderPost, setOrderPost] = useState<Post | null>(null);
  const [tipPost, setTipPost] = useState<Post | null>(null);
  const user = useAuth()
  console.log(user)

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

  const myPosts = posts.filter(
    (post) => post.address?.toLowerCase() === address?.toLowerCase(),
  );

  const getPostImage = (postId: string) => {
    const charCodeSum = postId
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const index = charCodeSum % chartImages.length;
    return chartImages[index];
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString();

  return (
    <div style={{ marginBottom: "80px" }}>
      {user?.user && <ProfileHeader user={user.user} />}

      {loading && (
        <p style={{ color: "#888", textAlign: "center", marginTop: "20px" }}>
          Loading activity...
        </p>
      )}

      {!loading && myPosts.length === 0 && (
        <div style={{ textAlign: "center", padding: "20px", color: "#888" }}>
          <p>No posts yet.</p>
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          padding: "0 16px",
        }}
      >
        {myPosts.map((post) => (
          <PostCard
            key={post.id}
            authorName={post.username || "Anonymous"}
            authorAvatar={post.avatar_url || undefined}
            date={formatDate(post.created_at)}
            content={post.content}
            postImage={getPostImage(post.id)}
            onSetOrder={() => setOrderPost(post)}
            onTip={() => setTipPost(post)}
          />
        ))}
      </div>

      {orderPost && (
        <SetOrderModal post={orderPost} onClose={() => setOrderPost(null)} />
      )}
      {tipPost && <TipModal post={tipPost} onClose={() => setTipPost(null)} />}
    </div>
  );
};
