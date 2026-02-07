import { PostCard } from "../../components/PostCard/PostCard";
import { ProfileHeader } from "../../components/ProfileHeader/ProfileHeader";
import { TradingAnalysisCard } from "../../components/TradingAnalysisCard/TradingAnalysisCard";
import profileImg from "../../assets/profile.png";
import chartImg from "../../assets/chart.png";
import ethImg from "../../assets/eth.png";

export const Profile = () => {
  return (
    <div style={{
      marginBottom: '80px'
    }}>
      <ProfileHeader />
      <PostCard />
      <TradingAnalysisCard
        chartImageUrl={chartImg}
        avatarUrl={profileImg}
        cryptoLogoUrl={ethImg}
      />
    </div>
  );
};
