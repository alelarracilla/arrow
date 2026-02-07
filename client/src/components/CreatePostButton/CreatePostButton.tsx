import { useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import styles from './CreatePostButton.module.css';
import { CreatePostModal } from './CreatePostModal';

export const CreatePostButton = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button className={styles.fab} onClick={() => setIsOpen(true)}>
        <FiPlus className={styles.icon} />
      </button>

      {isOpen && <CreatePostModal onClose={() => setIsOpen(false)} />}
    </>
  );
};
