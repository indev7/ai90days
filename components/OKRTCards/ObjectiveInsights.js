import styles from '../../app/okrt/page.module.css';

const RAG_FIELD_ID = 'customfield_11331';

const extractRagValue = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value.find(Boolean);
    return extractRagValue(first);
  }
  if (typeof value === 'object') {
    if (value.value !== undefined) return extractRagValue(value.value);
    if (value.name !== undefined) return extractRagValue(value.name);
    if (value.label !== undefined) return extractRagValue(value.label);
    if (value.status !== undefined) return extractRagValue(value.status);
    return '';
  }
  return String(value);
};

const getRagClassName = (ragValue) => {
  const normalized = (ragValue || '').toString().toLowerCase();
  if (normalized.includes('green')) return styles.initiativeRagGreen;
  if (normalized.includes('amber') || normalized.includes('yellow')) return styles.initiativeRagAmber;
  if (normalized.includes('red')) return styles.initiativeRagRed;
  return styles.initiativeRagUnknown;
};

const getInitiativeTitle = (initiative) => {
  return initiative?.summary || initiative?.title || initiative?.name || initiative?.key || 'Untitled initiative';
};

const getInitiativePills = (initiative) => {
  const pills = [];
  if (initiative?.status) pills.push(initiative.status);
  if (initiative?.priority) pills.push(initiative.priority);
  if (initiative?.dueDate) pills.push(initiative.dueDate);
  return pills;
};

export default function ObjectiveInsights({
  objective,
  jiraAuth,
  jiraIssueByKey
}) {
  const rawLinks = objective?.jira_links || objective?.jiraLinks || [];
  const normalizeKey = (value) => String(value || '').trim().toUpperCase();
  const isValidKey = (value) => /^[A-Z][A-Z0-9]+-\d+$/.test(value);
  const jiraKeys = rawLinks
    .map((link) => (typeof link === 'string' ? link : link?.jira_ticket_id))
    .map(normalizeKey)
    .filter((key) => isValidKey(key));
  const linkedInitiatives = jiraKeys
    .map((key) => jiraIssueByKey?.[key])
    .filter(Boolean);

  return (
    <div className={styles.objectiveInsightsGrid}>
      <div className={styles.objectiveInsightPanel}>
        <div className={styles.objectiveInsightHeader}>Initiatives</div>
        {linkedInitiatives.length === 0 ? (
          jiraKeys.length > 0 && jiraAuth?.checked && !jiraAuth?.authenticated ? (
            <div className={styles.objectiveInsightEmpty}>
              Connect Jira to view linked initiatives.
              <a className={styles.objectiveInitiativesLink} href="/api/jira/auth/login">
                Connect Jira
              </a>
            </div>
          ) : null
        ) : (
          <div className={styles.initiativesList}>
            {linkedInitiatives.map((initiative) => {
              const ragValue = extractRagValue(
                initiative?.customFields?.[RAG_FIELD_ID]
              );
              const pillItems = getInitiativePills(initiative);
              return (
                <div key={initiative.key || initiative.id} className={styles.initiativeItem}>
                  <span
                    className={`${styles.initiativeRagDot} ${getRagClassName(ragValue)}`}
                    title={ragValue ? `RAG: ${ragValue}` : 'RAG: Unknown'}
                    aria-hidden="true"
                  />
                  <div className={styles.initiativeContent}>
                    {jiraAuth?.siteUrl && initiative?.key ? (
                      <a
                        className={styles.initiativeTitleLink}
                        href={`${jiraAuth.siteUrl}/browse/${initiative.key}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Open in Jira"
                      >
                        {getInitiativeTitle(initiative)}
                      </a>
                    ) : (
                      <div className={styles.initiativeTitle}>{getInitiativeTitle(initiative)}</div>
                    )}
                    {pillItems.length > 0 && (
                      <div className={styles.initiativeMeta}>
                        {initiative?.key && jiraAuth?.siteUrl ? (
                          <a
                            className={`${styles.chip} ${styles['chip--default']} ${styles.initiativeKeyLink}`}
                            href={`${jiraAuth.siteUrl}/browse/${initiative.key}`}
                            target="_blank"
                            rel="noreferrer"
                            title="Open in Jira"
                          >
                            {initiative.key}
                          </a>
                        ) : initiative?.key ? (
                          <span className={`${styles.chip} ${styles['chip--default']}`}>
                            {initiative.key}
                          </span>
                        ) : null}
                        {pillItems.map((pill, idx) => (
                          <span key={`${pill}-${idx}`} className={`${styles.chip} ${styles['chip--default']}`}>
                            {pill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className={styles.objectiveInsightPanel}>
        <div className={styles.objectiveInsightHeader}>KPIs</div>
      </div>
    </div>
  );
}
