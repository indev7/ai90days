import styles from '../../app/okrt/page.module.css';

export default function ProgressBar({ value }) {
  return (
    <div className={styles.progressBar}>
      <div
        className={styles.progressBarFill}
        style={{ width: `${Math.min(100, Math.max(0, Math.round((value || 0) * 100)))}%` }}
      />
    </div>
  );
}