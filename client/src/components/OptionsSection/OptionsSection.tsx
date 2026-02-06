import { Option } from "../Option/Option"
import { HiOutlinePaperAirplane } from "react-icons/hi2";
import { HiArrowsRightLeft } from "react-icons/hi2";
import { HiArrowSmallDown } from "react-icons/hi2";
import { HiOutlinePlus } from "react-icons/hi2";
import styles from './OptionsSection.module.css';
export const OptionsSection = () => {
  return (
    <div className={styles.optionsSection}>
        <Option logo={<HiOutlinePaperAirplane />} optionText="Send" />
        <Option logo={<HiArrowsRightLeft />} optionText="Swap" />
        <Option logo={<HiArrowSmallDown />} optionText="Deposit" />
        <Option logo={<HiOutlinePlus />} optionText="Buy" />
    </div>
  )
}