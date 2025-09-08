'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCoach } from '@/contexts/CoachContext';
import styles from './page.module.css';
import OkrtPreview from '../../components/OkrtPreview';
import MessageMarkdown from '../../components/MessageMarkdown';

/* ---------- helpers ---------- */

function labelForAction(action) {
  const { intent, method, payload = {} } = action || {};
  const noun =
    payload?.type === 'O' ? 'Objective' :
    payload?.type === 'K' ? 'Key Result' :
    payload?.type === 'T' ? 'Task' :
    'OKRT';

  if (intent === 'CREATE_OKRT') return `Create ${noun}`;
  if (intent === 'UPDATE_OKRT') {
    if (payload?.title) return `Rename Objective`;
    if (typeof payload?.progress === 'number') return `Update ${noun} Progress`;
    if (payload?.task_status) return `Update Task Status`;
    if (payload?.description) return `Update ${noun} Description`;
    return `Update ${noun}`;
  }
  if (intent === 'DELETE_OKRT') return `Delete ${noun}`;
  return `${method || 'POST'} ${noun}`;
}

function normalizeActions(rawActions = []) {
  return rawActions.map((a, idx) => {
    const idFromPayload = a?.payload?.id;
    const endpoint = a?.endpoint?.includes('[id]')
      ? a.endpoint.replace('[id]', idFromPayload || '')
      : a?.endpoint || '/api/okrt';
    const label = labelForAction(a);
    return {
      key: `act-${idx}-${idFromPayload || Math.random().toString(36).slice(2)}`,
      label,
      endpoint,
      method: a?.method || 'POST',
      body: a?.payload || {},
      intent: a?.intent || 'UPDATE_OKRT',
    };
  });
}

/* ---------- components ---------- */

function ActionButtons({ actions, onActionClick, onRunAll }) {
  if (!actions || actions.length === 0) return null;
  return (
    <table className={styles.actionButtons}>
      <tbody>
        {actions.map((action) => {
          let description = '';
          if (action.method === 'POST') {
            if (action.body?.type === 'O') description = `Create Objective: ${action.body?.title || ''}`;
            else if (action.body?.type === 'K') description = `Create KR: ${action.body?.description || ''}`;
            else if (action.body?.type === 'T') description = `Create Task: ${action.body?.description || ''}`;
          } else if (action.method === 'PUT') {
            description = `Update ${action.body?.title || action.body?.description || 'OKRT'}`;
          } else if (action.method === 'DELETE') {
            description = `Delete ${action.body?.title || action.body?.description || 'OKRT'}`;
          }
          return (
            <tr key={action.key}>
              <td>{description}</td>
              <td>
                <button
                  className={styles.actionButton}
                  onClick={() => onActionClick(action)}
                  title={JSON.stringify(action.body || {}, null, 2)}
                >
                  Accept
                </button>
              </td>
            </tr>
          );
        })}
        {actions.length > 1 && (
          <tr>
            <td></td>
            <td>
              <button
                className={`${styles.actionButton} ${styles.actionButtonPrimary}`}
                onClick={onRunAll}
                title="Execute all actions in order"
              >
                Accept All
              </button>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function HtmlFormHandler({ htmlContent, onFormSubmit }) {
  const containerRef = useRef(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const handleFormSubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      let endpoint = form.dataset.endpoint;
      const method = form.dataset.method || 'POST';
      const formData = new FormData(form);
      const data = {};
      for (const [key, value] of formData.entries()) data[key] = value;
      if (method === 'POST' && data.type && endpoint !== '/api/okrt') endpoint = '/api/okrt';
      onFormSubmit(endpoint, method, data);
    };
    const forms = containerRef.current.querySelectorAll('form.coach-form');
    forms.forEach((form) => form.addEventListener('submit', handleFormSubmit));
    return () => forms.forEach((form) => form.removeEventListener('submit', handleFormSubmit));
  }, [htmlContent, onFormSubmit]);
  return (
    <div ref={containerRef} className={styles.actionForms} dangerouslySetInnerHTML={{ __html: htmlContent }} />
  );
}

function Message({ message, onActionClick, onRunAll, onRetry, onFormSubmit, onQuickReply }) {
  const isUser = message.role === 'user';

  const htmlMatch = message.content?.match(/<ACTION_HTML>([\s\S]*?)<\/ACTION_HTML>/);
  const textOnly = htmlMatch
    ? message.content.replace(/<ACTION_HTML>[\s\S]*?<\/ACTION_HTML>/g, '').trim()
    : message.content;
  const htmlContent = htmlMatch ? htmlMatch[1] : null;

  return (
    <div className={`${styles.message} ${isUser ? styles.userMessage : styles.assistantMessage}`}>
      <div className={styles.messageContent}>
        {message.error ? (
          <div className={styles.errorMessage}>
            <p>{textOnly}</p>
            <button className={styles.retryButton} onClick={onRetry}>Retry</button>
          </div>
        ) : (
          <>
            {/* Render Markdown nicely */}
            <MessageMarkdown>{textOnly}</MessageMarkdown>

            {/* OKRT Suggestion box disabled */}
            {/* Removed OkrtPreview to hide suggestion box */}

            {/* Spinners for actions */}
            {!isUser && message.preparingActions && (
              <div className={styles.actionsLoading}>
                <div className={styles.spinner}></div>
                <span>Preparing your actions...</span>
              </div>
            )}
            {!isUser && message.processingActions && (
              <div className={styles.actionsLoading}>
                <div className={styles.spinner}></div>
                <span>Processing actions...</span>
              </div>
            )}

            {/* Structured action buttons */}
            {!isUser && message.actions?.length > 0 && (
              <ActionButtons
                actions={message.actions}
                onActionClick={onActionClick}
                onRunAll={onRunAll}
              />
            )}

            {/* Legacy HTML fallback */}
            {!isUser && htmlContent && (
              <HtmlFormHandler htmlContent={htmlContent} onFormSubmit={onFormSubmit} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function CoachPage() {
  const router = useRouter();
  const { messages, addMessage, updateMessage, isLoading, setLoading } = useCoach();
  const [input, setInput] = useState('');
  const [user, setUser] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) setUser((await response.json()).user);
        else router.push('/login');
      } catch (err) {
        console.error('Auth check failed:', err);
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  const sendMessage = async (messageContent = input) => {
    if (!messageContent.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: messageContent.trim(),
      timestamp: new Date(),
    };

    addMessage(userMessage);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage].slice(-10) }),
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      const assistantMessageId = Date.now() + 1;
      const assistantMsg = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        actions: [],
        timestamp: new Date(),
      };
      addMessage(assistantMsg);

      let textBuffer = '';
      let pendingActions = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.type === 'content') {
              textBuffer += data.data;
              updateMessage(assistantMessageId, { content: textBuffer });
            } else if (data.type === 'preparing_actions') {
              updateMessage(assistantMessageId, { content: textBuffer, preparingActions: true });
            } else if (data.type === 'actions') {
              pendingActions = normalizeActions(data.data || []);
              updateMessage(assistantMessageId, {
                content: textBuffer,
                preparingActions: false,
                processingActions: false,
                actions: pendingActions
              });
            } else if (data.type === 'done') {
              // no-op
            }
          } catch (e) {
            console.error('Stream parse error:', e, 'Line was:', line);
          }
        }
      }

      if (pendingActions.length > 0) {
        updateMessage(assistantMessageId, { content: textBuffer, actions: pendingActions, preparingActions: false });
      } else {
        updateMessage(assistantMessageId, { content: textBuffer, preparingActions: false });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      addMessage({
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        error: true,
        timestamp: new Date(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = async (action) => {
    setLoading(true);
    try {
      const payload = { ...action.body };
      const res = await fetch(action.endpoint, {
        method: action.method,
        headers: { 'Content-Type': 'application/json' },
        body: action.method === 'DELETE' ? undefined : JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      addMessage({ id: Date.now(), role: 'assistant', content: `✅ ${action.label} completed successfully!`, timestamp: new Date() });
    } catch (err) {
      console.error('Action error:', err);
      addMessage({ id: Date.now(), role: 'assistant', content: `❌ Failed to execute "${action.label}". ${err.message}`, error: true, timestamp: new Date() });
    } finally {
      setLoading(false);
    }
  };

  const handleRunAll = async (actions) => {
    setLoading(true);
    try {
      for (const action of actions) {
        const payload = { ...action.body };
        const res = await fetch(action.endpoint, {
          method: action.method,
          headers: { 'Content-Type': 'application/json' },
          body: action.method === 'DELETE' ? undefined : JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`API error: ${res.status} on "${action.label}"`);
      }
      addMessage({ id: Date.now(), role: 'assistant', content: `✅ All actions completed successfully!`, timestamp: new Date() });
    } catch (err) {
      console.error('Run All error:', err);
      addMessage({ id: Date.now(), role: 'assistant', content: `❌ Failed while executing actions. ${err.message}`, error: true, timestamp: new Date() });
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (endpoint, method, data) => {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'DELETE' ? undefined : JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      addMessage({ id: Date.now(), role: 'assistant', content: `✅ Request completed successfully!`, timestamp: new Date() });
    } catch (error) {
      console.error('Form submission error:', error);
      addMessage({ id: Date.now(), role: 'assistant', content: `❌ ${error.message}`, error: true, timestamp: new Date() });
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    if (lastUserMessage) sendMessage(lastUserMessage.content);
  };

  const handleSubmit = (e) => { e.preventDefault(); sendMessage(); };
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleQuickReply = (text) => sendMessage(text);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Coach</h1>
        <p className={styles.subtitle}>Your OKRT Coach</p>
      </div>

      <div className={styles.messagesContainer}>
        {messages.length === 0 && (
          <div className={styles.welcomeMessage}>
            <div className={styles.coachAvatar}>🏃‍♂️</div>
            <p>Hi! I'm your OKRT coach. I can help you create objectives, key results, and tasks. What would you like to work on today?</p>
          </div>
        )}

        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            onActionClick={handleActionClick}
            onRunAll={() => handleRunAll(message.actions || [])}
            onRetry={handleRetry}
            onFormSubmit={handleFormSubmit}
            onQuickReply={handleQuickReply}
          />
        ))}

        {isLoading && (
          <div className={styles.loadingMessage}>
            <div className={styles.typingIndicator}><span></span><span></span><span></span></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className={styles.inputForm}>
        <div className={styles.inputContainer}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me about your OKRTs..."
            className={styles.input}
            disabled={isLoading}
            rows={1}
          />
          <button type="submit" className={styles.sendButton} disabled={isLoading || !input.trim()}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
