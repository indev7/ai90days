# Understanding `CoachPage` (`app/coach/page.js`)

This document explains the structure and flow of the **CoachPage** React component within the **90 Days OKRT App**. It is designed to be **printed and read leisurely**, providing both a **big-picture overview** and **inlined annotated source code**.

---

## 📖 Big Picture Overview

The `CoachPage` is the **conversational coaching interface** where users interact with an AI-powered coach to manage their OKRTs (Objectives, Key Results, and Tasks).  

Key features:

- **Chat interface** with user/assistant messages.
- **Streaming AI responses** (LLM stream processing).
- **Action handling**:
  - Suggested **OKRT actions** (create, update, delete).
  - Ability to **Accept** or **Accept All** actions.
- **Form handling fallback** (if messages contain `<ACTION_HTML>` markup).
- **Authentication** (redirects to `/login` if no user found).
- **Interactive input box** for user prompts.

The page ties together:
- ✅ **Message rendering** (Markdown, actions, forms)
- ✅ **User input handling** (send, retry, quick reply)
- ✅ **API communication** (`/api/llm`, `/api/okrt`, `/api/me`)
- ✅ **State management** with `useCoach` context

---


Below is the **source code with inline comments** for easier understanding.

```javascript
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCoach } from '@/contexts/CoachContext';   // Centralized chat state/context
import styles from './page.module.css';
import OkrtPreview from '../../components/OkrtPreview'; // (currently disabled in UI)
import MessageMarkdown from '../../components/MessageMarkdown';

/* ---------- helpers ---------- */

// Generate human-readable labels for OKRT actions
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

// Normalize actions received from the LLM or backend
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

// Renders "Accept" buttons for suggested OKRT actions
function ActionButtons({ actions, onActionClick, onRunAll }) { ... }

// Handles injected HTML forms from assistant messages
function HtmlFormHandler({ htmlContent, onFormSubmit }) { ... }

// Renders a single message bubble (Markdown, Actions, Forms, Error/Retry)
function Message({ message, onActionClick, onRunAll, onRetry, onFormSubmit, onQuickReply }) { ... }

/* ---------- Main Page ---------- */

export default function CoachPage() {
  const router = useRouter();
  const { messages, addMessage, updateMessage, isLoading, setLoading } = useCoach();
  const [input, setInput] = useState('');
  const [user, setUser] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // 🔑 Auto-scroll when new messages arrive
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // 🔑 Auth check -> redirect to `/login` if not authenticated
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) setUser((await response.json()).user);
        else router.push('/login');
      } catch {
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  // 📤 Send user message to LLM endpoint (/api/llm), stream response back
  const sendMessage = async (messageContent = input) => { ... };

  // ✅ Execute one action
  const handleActionClick = async (action) => { ... };

  // ✅ Execute all actions
  const handleRunAll = async (actions) => { ... };

  // ✅ Handle legacy HTML form submissions
  const handleFormSubmit = async (endpoint, method, data) => { ... };

  // 🔄 Allow retrying last failed message
  const handleRetry = () => { ... };

  // 🔢 UI for sending messages
  const handleSubmit = (e) => { e.preventDefault(); sendMessage(); };
  const handleKeyPress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const handleQuickReply = (text) => sendMessage(text);

  return (
    <div className={styles.container}>
      {/* Top header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Coach</h1>
        <p className={styles.subtitle}>Your OKRT Coach</p>
      </div>

      {/* Messages window */}
      <div className={styles.messagesContainer}>
        {messages.length === 0 && (
          <div className={styles.welcomeMessage}>
            <div className={styles.coachAvatar}>🏃‍♂️</div>
            <p>Welcome intro text...</p>
          </div>
        )}

        {/* Render all messages */}
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

        {isLoading && <div className={styles.loadingMessage}> ... typing ... </div>}

        <div ref={messagesEndRef} />
      </div>

      {/* Input form */}
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
```

---

## 📝 Summary

- The `CoachPage` orchestrates **chat UX**, **stateful conversation**, and **OKRT manipulation**.  
- It integrates with `/api/me` (auth), `/api/llm` (AI chat), `/api/okrt` (objectives).  
- Presents a **modern AI-assisted coaching experience** for OKRT methodology.  
