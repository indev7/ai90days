'use client';

import styles from './InitiativeCard.module.css';

function extractRagValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value.find(Boolean);
    return extractRagValue(first);
  }
  if (typeof value === 'object') {
    return value.value || value.name || value.label || value.status || '';
  }
  return String(value);
}

function getRagClass(ragValue) {
  const normalized = (ragValue || '').toString().toLowerCase();
  if (normalized.includes('green')) return styles.ragGreen;
  if (normalized.includes('amber') || normalized.includes('yellow')) return styles.ragAmber;
  if (normalized.includes('red')) return styles.ragRed;
  return styles.ragUnknown;
}

export default function InitiativeCard({
  initiative,
  jiraSiteUrl,
  ragFieldId = 'customfield_11331',
}) {
  if (!initiative?.key) return null;

  const ragValueText = extractRagValue(initiative?.customFields?.[ragFieldId]);
  const priority = initiative?.priority || '';
  const dueDate = initiative?.dueDate || '';
  const summary = initiative?.summary || '';

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        {jiraSiteUrl ? (
          <a
            className={styles.keyLink}
            href={`${jiraSiteUrl}/browse/${initiative.key}`}
            target="_blank"
            rel="noreferrer"
            title="Open in Jira"
          >
            {initiative.key}
          </a>
        ) : (
          <span className={styles.key}>{initiative.key}</span>
        )}
        {ragValueText ? (
          <span className={`${styles.ragPill} ${getRagClass(ragValueText)}`} title="RAG">
            {ragValueText}
          </span>
        ) : null}
      </div>
      <div className={styles.title}>{summary}</div>
      <div className={styles.metaRow}>
        {priority ? (
          <span className={`${styles.metaPill} ${styles.priorityPill}`} title="Priority">
            {priority}
          </span>
        ) : null}
        {dueDate ? (
          <span className={`${styles.metaPill} ${styles.dueDatePill}`} title="Due Date">
            {dueDate}
          </span>
        ) : null}
      </div>
    </div>
  );
}
