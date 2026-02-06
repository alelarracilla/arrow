import styles from './Option.module.css';

type OptionProps = {
  logo: React.ReactNode;
  optionText: string;
}

export const Option = ({ logo, optionText }: OptionProps) => {
  return <div className={styles.optionContainer}>
    <div className={styles.optionLogo}>
        {logo}
    </div>
    <p className={styles.optionText}>
        {optionText}
    </p>
  </div>;
}