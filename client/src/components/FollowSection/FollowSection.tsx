import React, { useEffect, useState } from "react";
import styles from "./FollowSection.module.css";
import { FollowSuggestion } from "../FollowSuggestion/FollowSuggestion";
import { followUser, topUsersByTipsReceived } from "../../api/client";

export const FollowSection: React.FC = () => {
  const [traders, setTraders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const handleOnFollow = (id: string) => {
    followUser(id);
  };

  useEffect(() => {    
    const fetchTraders = async () => {
      try {
        const response = await topUsersByTipsReceived();
        const result = await response.json();
        if (result.data && result.data.EVM) {
          
          const rawList = result.data.EVM.DEXTrades;
          const mappedTraders = rawList.map((item: any, index: number) => {
              const address = item.Trade.Buy.Buyer; 
              const displayName = `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;

              return {
                id: address, 
                name: displayName,
                profilePhoto: `https://effigy.im/a/${address}.png`,
              };
            }
          );

          setTraders(mappedTraders);
        }
      } catch (error) {
        console.error("Error fetching traders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTraders();
  }, []);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>
        {loading ? "Discovering top traders..." : "Discover top traders"}
      </h2>
      
      <div className={styles.followSection}>
        {!loading && traders.length > 0 
          ? traders.map((suggestion) => (
              <FollowSuggestion
                key={suggestion.id}
                id={suggestion.id}
                name={suggestion.name}
                profilePhoto={suggestion.profilePhoto}
                onFollow={() => {
                  handleOnFollow(suggestion.id);
                }}
              />
            ))
          : null}
      </div>
    </div>
  );
};