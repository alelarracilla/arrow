import styles from './NewsSection.module.css';
import { NewsCard } from '../NewsCard/NewsCard';
import chart from '../../assets/chart.png';
export const NewsSection = () => {
    return (
        <div className={styles.newsSection}>
            <h2 className={styles.title}>Latest Posts</h2>
            <NewsCard
                image={chart}
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