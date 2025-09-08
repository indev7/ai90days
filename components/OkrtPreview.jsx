'use client';

import React from 'react';

function parseOkrtFromText(text) {
  if (!text) return null;

  const objMatch = text.match(/(?:\*\*\s*)?Objective\s*:?\s*(?:\*\*)?\s*(.+)/i);
  const objective = objMatch ? objMatch[1].trim() : null;

  const krStartIdx = (() => {
    const md = text.match(/\*\*\s*Key\s*Results\s*:\s*\*\*/i);
    if (md) return md.index + md[0].length;
    const p = text.match(/Key\s*Results\s*:/i);
    if (p) return p.index + p[0].length;
    return -1;
  })();

  if (!objective || krStartIdx === -1) return null;

  const tail = text.slice(krStartIdx);
  const lines = tail.split(/\r?\n/);

  const krIndices = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*(\d+)\s*[\.|\)]\s*(.+)$/);
    if (m) krIndices.push(i);
  }
  if (krIndices.length === 0) return { objective, krs: [] };

  const krs = [];
  for (let k = 0; k < krIndices.length; k++) {
    const start = krIndices[k];
    const end = k + 1 < krIndices.length ? krIndices[k + 1] : lines.length;
    const headerLine = lines[start];
    const headerMatch = headerLine.match(/^\s*\d+\s*[\.|\)]\s*(.+)$/);
    const header = headerMatch ? headerMatch[1].trim() : '';

    const bullets = [];
    for (let i = start + 1; i < end; i++) {
      const b = lines[i].match(/^\s*[-–]\s*(.+)$/);
      if (b) bullets.push(b[1].trim());
    }

    krs.push({ title: header.replace(/^\*\*|\*\*$/g, ''), bullets });
  }

  return { objective, krs };
}

export default function OkrtPreview({ text, onAccept }) {
  const parsed = parseOkrtFromText(text);
  if (!parsed) return null;

  const { objective, krs } = parsed;

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.header}>OKRT Suggestion</div>
        <div style={styles.section}>
          <div style={styles.label}>Objective</div>
          <div style={styles.objective}>{objective}</div>
        </div>

        <div style={styles.section}>
          <div style={styles.label}>Key Results</div>
          <ol style={styles.krList}>
            {krs.map((kr, idx) => (
              <li key={idx} style={styles.krItem}>
                <div style={styles.krTitle}>{kr.title}</div>
                {kr.bullets && kr.bullets.length > 0 && (
                  <ul style={styles.subList}>
                    {kr.bullets.map((b, j) => (
                      <li key={j} style={styles.subItem}>{b}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </div>

        {typeof onAccept === 'function' && (
          <div style={styles.actions}>
            <button
              type="button"
              onClick={() => onAccept('Yes, create this objective and all listed key results exactly as shown.')}
              style={{ ...styles.button, ...styles.primary }}
              title="Ask the coach to create these in the app"
            >
              Create as shown
            </button>
            <button
              type="button"
              onClick={() => onAccept('Let’s tweak these KRs. For KR 1, change the target and add a date…')}
              style={styles.button}
            >
              Tweak first
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrapper: { marginTop: 8, marginBottom: 8 },
  card: {
    border: '1px solid rgba(0,0,0,0.08)',
    borderRadius: 12,
    padding: 16,
    background: 'linear-gradient(180deg, rgba(255,255,255,0.8), rgba(255,255,255,0.6))',
    backdropFilter: 'blur(2px)',
  },
  header: { fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase', opacity: 0.6, marginBottom: 8 },
  section: { marginBottom: 12 },
  label: { fontSize: 12, opacity: 0.7, marginBottom: 4 },
  objective: { fontWeight: 600, lineHeight: 1.35 },
  krList: { margin: 0, paddingLeft: 18 },
  krItem: { marginBottom: 8 },
  krTitle: { fontWeight: 500 },
  subList: { marginTop: 6, paddingLeft: 16, marginBottom: 0, listStyleType: 'disc' },
  subItem: { opacity: 0.9 },
  actions: { display: 'flex', gap: 8, marginTop: 10 },
  button: {
    borderRadius: 8,
    border: '1px solid rgba(0,0,0,0.1)',
    padding: '6px 10px',
    background: 'white',
    cursor: 'pointer'
  },
  primary: { background: '#111', color: 'white', border: '1px solid #111' }
};
