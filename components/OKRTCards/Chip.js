import styles from '../../app/okrt/page.module.css';

export default function Chip({ text, variant = "default" }) {
  return (
    <span className={`${styles.chip} ${styles[`chip--${variant}`]}`}>
      {text}
    </span>
  );
}