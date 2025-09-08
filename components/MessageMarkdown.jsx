'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export default function MessageMarkdown({ children }) {
  const text = typeof children === 'string' ? children : '';
  if (!text) return null;
  return (
    <div className="md-wrap">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
      <style jsx>{`
        .md-wrap :global(h1,h2,h3){ margin: 0.4rem 0 0.2rem; }
        .md-wrap :global(p){ margin: 0.35rem 0; line-height: 1.45; }
        .md-wrap :global(ul){ margin: 0.25rem 0 0.25rem 1.25rem; }
        .md-wrap :global(ol){ margin: 0.25rem 0 0.25rem 1.25rem; }
        .md-wrap :global(code){ background: rgba(0,0,0,0.05); padding: 0.1rem 0.25rem; border-radius: 4px; }
        .md-wrap :global(table){ border-collapse: collapse; width: 100%; font-size: 0.95em; }
        .md-wrap :global(th, td){ border: 1px solid rgba(0,0,0,0.1); padding: 6px 8px; }
        .md-wrap :global(blockquote){ border-left: 3px solid rgba(0,0,0,0.15); padding-left: 10px; margin: 6px 0; color: #444; }
        .md-wrap :global(a){ color: #0b5fff; text-decoration: none; }
        .md-wrap :global(a:hover){ text-decoration: underline; }
      `}</style>
    </div>
  );
}
