import styles from "./FollowSection.module.css";
import { FollowSuggestion } from "../FollowSuggestion/FollowSuggestion";
import u1img from "../../assets/u1.png";
import u2img from "../../assets/u2.png";

const FOLLOSUGGESTION_PLACEHOLDER = [
  {
    id: "1",
    name: "john_doe",
    profilePhoto: u1img,
  },
  {
    id: "2",
    name: "jane_smith",
    profilePhoto: u2img,
  },
  {
    id: "3",
    name: "alice_jones",
    profilePhoto: u1img,
  },
  {
    id: "4",
    name: "bob_brown",
    profilePhoto: u2img,
  },
  {
    id: "5",
    name: "charlie_black",
    profilePhoto: u1img,
  },
  {
    id: "6",
    name: "david_white",
    profilePhoto: u2img,
  },
  {
    id: "7",
    name: "eve_green",
    profilePhoto: u1img,
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
