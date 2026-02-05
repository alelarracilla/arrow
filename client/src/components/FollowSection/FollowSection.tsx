import styles from "./FollowSection.module.css";
import { FollowSuggestion } from "../FollowSuggestion/FollowSuggestion";

const FOLLOSUGGESTION_PLACEHOLDER = [
  {
    id: "1",
    name: "john_doe",
    profilePhoto: "https://picsum.photos/id/1/200/300",
  },
  {
    id: "2",
    name: "jane_smith",
    profilePhoto: "https://picsum.photos/id/1/200/300",
  },
  {
    id: "3",
    name: "alice_jones",
    profilePhoto: "https://picsum.photos/id/1/200/300",
  },
  {
    id: "4",
    name: "bob_brown",
    profilePhoto: "https://picsum.photos/id/1/200/300",
  },
  {
    id: "5",
    name: "charlie_black",
    profilePhoto: "https://picsum.photos/id/1/200/300",
  },
  {
    id: "6",
    name: "david_white",
    profilePhoto: "https://picsum.photos/id/1/200/300",
  },
  {
    id: "7",
    name: "eve_green",
    profilePhoto: "https://picsum.photos/id/1/200/300",
  },
];

export const FollowSection: React.FC = () => {
  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Discover top traders</h2>
      <div className={styles.followSection}>
        {FOLLOSUGGESTION_PLACEHOLDER.map((suggestion) => (
          <FollowSuggestion
            key={suggestion.id}
            id={suggestion.id}
            name={suggestion.name}
            profilePhoto={suggestion.profilePhoto}
            onFollow={() => {}}
          />
        ))}
      </div>
    </div>
  );
};
