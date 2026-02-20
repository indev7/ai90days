'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './snowflake.module.css';

const DEFAULT_SQL = 'SELECT COUNT(*) as RECORD_COUNT FROM RP_TRP_REVIEWS_TEST;';

const deriveTable = (payload) => {
  const data = payload?.data;
  if (!data?.resultSetMetaData?.rowType || !Array.isArray(data?.data)) return null;

  const columns = data.resultSetMetaData.rowType.map((col) => col.name);
  const rows = data.data;
  return { columns, rows };
};

export default function SnowflakePage() {
  const [status, setStatus] = useState('loading');
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;

    const runQuery = async () => {
      try {
        const response = await fetch('/api/snowflake/query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sql: DEFAULT_SQL })
        });

        const json = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(json?.error || `Request failed (${response.status})`);
        }

        if (isMounted) {
          setPayload(json);
          setStatus('success');
        }
      } catch (err) {
        if (isMounted) {
          setError(err?.message || 'Request failed.');
          setStatus('error');
        }
      }
    };

    runQuery();

    return () => {
      isMounted = false;
    };
  }, []);

  const table = useMemo(() => deriveTable(payload), [payload]);

  return (
    <div className={styles.page}>
      <section className={styles.card}>
        <div className={styles.header}>
          <div>
            <h1>Snowflake Connectivity</h1>
            <p>Test query: <span className={styles.query}>{DEFAULT_SQL}</span></p>
          </div>
          <span className={`${styles.badge} ${styles[status]}`}>{status}</span>
        </div>

        {status === 'loading' && <p className={styles.info}>Running query...</p>}

        {status === 'error' && (
          <div className={styles.error}>
            <p>Query failed.</p>
            <pre>{error}</pre>
          </div>
        )}

        {status === 'success' && table && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {table.columns.map((col) => (
                    <th key={col}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {status === 'success' && !table && (
          <div className={styles.info}>
            <p>Response payload:</p>
            <pre>{JSON.stringify(payload, null, 2)}</pre>
          </div>
        )}
      </section>
    </div>
  );
}
