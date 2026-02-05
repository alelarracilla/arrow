import styles from './NewsSection.module.css';
import { NewsCard } from '../NewsCard/NewsCard';
export const NewsSection = () => {
    return (
        <div className={styles.newsSection}>
            <h2 className={styles.title}>Latest Posts</h2>
            <NewsCard
                image="https://picsum.photos/id/10/400/200"
                description="Stay updated with the latest news in the tech world."
                buttonText="Read More"
                onButtonClick={() => {
                    console.log("News Card Button Clicked");
                }}
            >
                Tech News Daily 
            </NewsCard>
        </div>
    );
}