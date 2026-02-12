'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';

export default function ConfluencePage() {
  const [auth, setAuth] = useState({
    checked: false,
    authenticated: false,
    siteUrl: null,
    error: null
  });

  const refreshStatus = async () => {
    try {
      const response = await fetch('/api/confluence/auth/status');
      const data = await response.json();
      setAuth({
        checked: true,
        authenticated: Boolean(data?.authenticated),
        siteUrl: data?.siteUrl || null,
        error: null
      });
    } catch (error) {
      setAuth({
        checked: true,
        authenticated: false,
        siteUrl: null,
        error: 'Unable to check Confluence status'
      });
    }
  };

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleConnect = () => {
    window.location.href = '/api/confluence/auth/login?returnTo=/confluence';
  };

  const handleDisconnect = async () => {
    await fetch('/api/confluence/auth/logout', { method: 'POST' });
    refreshStatus();
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Confluence</h1>
        <p className={styles.subtitle}>
          Connect Confluence to let AIME search your company knowledge base.
        </p>

        {auth.checked ? (
          auth.authenticated ? (
            <div className={styles.status}>
              <div className={styles.badge}>Connected</div>
              <div className={styles.meta}>
                {auth.siteUrl ? `Site: ${auth.siteUrl}` : 'Site connected'}
              </div>
              <button className={styles.secondaryButton} onClick={handleDisconnect}>
                Disconnect
              </button>
            </div>
          ) : (
            <div className={styles.status}>
              <div className={styles.badgeMuted}>Not connected</div>
              {auth.error ? <div className={styles.error}>{auth.error}</div> : null}
              <button className={styles.primaryButton} onClick={handleConnect}>
                Connect Confluence
              </button>
            </div>
          )
        ) : (
          <div className={styles.status}>Checking status...</div>
        )}
      </div>
    </div>
  );
}
