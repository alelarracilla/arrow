import React from "react";
import styles from "./ProfilesList.module.css";

interface ProfileData {
  id: string;
  name: string;
  followers: string;
  avatarUrl: string;
}

const profilesData: ProfileData[] = [
  {
    id: "1",
    name: "Vitálik Buterin",
    followers: "7.5k Followers",
    avatarUrl:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Vitalik&backgroundColor=b6e3f4",
  },
  {
    id: "2",
    name: "Fusaka",
    followers: "1.9k Followers",
    avatarUrl:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Fusaka&backgroundColor=c0aede",
  },
  {
    id: "3",
    name: "MoonBoy",
    followers: "2.3k Followers",
    avatarUrl:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=MoonBoy&backgroundColor=ffdfbf",
  },
  {
    id: "4",
    name: "ToDaMoon",
    followers: "1.6k Followers",
    avatarUrl:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=ToDaMoon&backgroundColor=d1d4f9",
  },
];

const ProfilesList: React.FC = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Profiles</h1>

      <div className={styles.profileList}>
        {profilesData.map((profile) => (
          <div key={profile.id} className={styles.card}>
            <div className={styles.leftSection}>
              <img
                src={profile.avatarUrl}
                alt={`${profile.name} avatar`}
                className={styles.avatar}
              />
              <span className={styles.name}>{profile.name}</span>
            </div>
            <span className={styles.followers}>{profile.followers}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProfilesList;
