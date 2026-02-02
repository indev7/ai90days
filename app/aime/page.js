'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useAimeStore from '@/store/aimeStore';
import { useUser } from '@/hooks/useUser';
import useMainTreeStore from '@/store/mainTreeStore';
import { useMainTree } from '@/hooks/useMainTree';
import useTextToSpeech from '@/hooks/useTextToSpeech';
import useVoiceInput from '@/hooks/useVoiceInput';
import styles from './page.module.css';
import OkrtPreview from '../../components/OkrtPreview';
import MessageMarkdown from '../../components/MessageMarkdown';
import AimeChart from '../../components/AimeChart';
import { TiMicrophoneOutline } from "react-icons/ti";
import { PiSpeakerSlash, PiSpeakerHighBold } from "react-icons/pi";
import { SlArrowUpCircle } from "react-icons/sl";

const DATA_SECTION_IDS = new Set([
  'myOKRTs',
  'sharedOKRTs',
  'groups',
  'timeBlocks',
  'notifications',
  'preferences',
  'calendar'
]);

/** Merge incoming req_more_info payloads into accumulator maps/sets for later consolidation; called in sendMessage after streaming req_more_info. */
// PSEUDOCODE: for each incoming section/reason/id, validate and add to accumulator maps/sets.
const mergeReqMoreInfo = (accumulator, incoming) => {
  const sections = Array.isArray(incoming?.data?.sections)
    ? incoming.data.sections
    : [];
  for (const section of sections) {
    const sectionId = section?.sectionId;
    if (!sectionId || !DATA_SECTION_IDS.has(sectionId)) continue;
    const existing = accumulator.sections.get(sectionId) || {
      sectionId,
      reasons: new Set()
    };
    if (typeof section?.reason === 'string' && section.reason.trim()) {
      existing.reasons.add(section.reason.trim());
    }
    accumulator.sections.set(sectionId, existing);
  }

  const knowledgeIds = Array.isArray(incoming?.domainKnowledge?.ids)
    ? incoming.domainKnowledge.ids
    : [];
  for (const id of knowledgeIds) {
    if (id) accumulator.knowledgeIds.add(id);
  }

  const toolIds = Array.isArray(incoming?.tools?.ids)
    ? incoming.tools.ids
    : [];
  for (const id of toolIds) {
    if (id) accumulator.toolIds.add(id);
  }
};


/** Build a normalized req_more_info object from the accumulated sections and ID sets; called in sendMessage before auto-retry. */
// PSEUDOCODE: serialize sections/reasons and id sets into a compact object, omitting empties.
const buildMergedReqMoreInfo = (accumulator) => {
  const merged = {};
  const sections = Array.from(accumulator.sections.values()).map(({ sectionId, reasons }) => ({
    sectionId,
    ...(reasons?.size ? { reason: Array.from(reasons).join(' | ') } : {})
  }));
  if (sections.length > 0) {
    merged.data = { sections };
  }
  if (accumulator.knowledgeIds.size > 0) {
    merged.domainKnowledge = { ids: Array.from(accumulator.knowledgeIds) };
  }
  if (accumulator.toolIds.size > 0) {
    merged.tools = { ids: Array.from(accumulator.toolIds) };
  }
  return merged;
};

/** Recursively check whether a value contains any non-empty, user-meaningful data; called by buildSystemPromptPayload. */
// PSEUDOCODE: walk value by type and return true if any leaf is non-empty.
const hasMeaningfulValue = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (typeof value === 'object') return Object.values(value).some(hasMeaningfulValue);
  return false;
};

/** Drop null/undefined values recursively so LLM context stays compact without touching UI state. */
// PSEUDOCODE: walk arrays/objects and omit nullish entries, preserving other values.
const pruneNullish = (value) => {
  if (value === null || value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((item) => pruneNullish(item))
      .filter((item) => item !== undefined);
  }
  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, child]) => {
      const cleaned = pruneNullish(child);
      if (cleaned !== undefined) {
        acc[key] = cleaned;
      }
      return acc;
    }, {});
  }
  return value;
};

const truncateDateOnly = (value) => {
  if (typeof value !== 'string') return value;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : value;
};

/** Normalize date fields for LLM payloads without affecting timeBlocks data. */
// PSEUDOCODE: for non-timeBlocks sections, traverse and truncate due_date to YYYY-MM-DD.
const normalizeDatesForLLM = (sectionId, value) => {
  if (value === null || value === undefined) return value;
  if (sectionId === 'timeBlocks') return value;
  if (Array.isArray(value)) {
    return value.map((item) => normalizeDatesForLLM(sectionId, item));
  }
  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, child]) => {
      if (key === 'due_date' || key === 'created_at' || key === 'updated_at') {
        acc[key] = truncateDateOnly(child);
      } else {
        acc[key] = normalizeDatesForLLM(sectionId, child);
      }
      return acc;
    }, {});
  }
  return value;
};

/** Construct system prompt payload text plus a fingerprint to detect duplicate retries; called in sendMessage when req_more_info arrives. */
// PSEUDOCODE: filter requested sections, build <DATA> blocks, and hash the payload into a fingerprint.
const buildSystemPromptPayload = (reqMoreInfo, mainTree, displayName) => {
  const sections = reqMoreInfo?.data?.sections;
  const requestedTools = Array.isArray(reqMoreInfo?.tools?.ids)
    ? reqMoreInfo.tools.ids.filter(Boolean)
    : [];
  const requestedKnowledge = Array.isArray(reqMoreInfo?.domainKnowledge?.ids)
    ? reqMoreInfo.domainKnowledge.ids.filter(Boolean)
    : [];
  const hasToolRequest = requestedTools.length > 0;
  const hasKnowledgeRequest = requestedKnowledge.length > 0;
  const buildNonDataContext = () => {
    if (!hasToolRequest && !hasKnowledgeRequest) return '';
    const lines = [
      'CONTEXT - Requested tools/knowledge only (no mainTree sections).'
    ];
    if (hasToolRequest) lines.push(`Tools requested: ${requestedTools.join(', ')}`);
    if (hasKnowledgeRequest) lines.push(`Knowledge requested: ${requestedKnowledge.join(', ')}`);
    lines.push('If required tools/knowledge are already available, proceed without requesting more info.');
    return lines.join('\n');
  };
  if (!Array.isArray(sections) || sections.length === 0) {
    return {
      text: buildNonDataContext(),
      fingerprint: JSON.stringify({
        tools: requestedTools,
        domainKnowledge: requestedKnowledge
      }),
      hasData: false,
      hasToolRequest,
      hasKnowledgeRequest
    };
  }

  const merged = new Map();
  for (const section of sections) {
    const sectionId = section?.sectionId;
    if (!sectionId || !DATA_SECTION_IDS.has(sectionId)) continue;
    const entry = merged.get(sectionId) || {
      sectionId,
      reasons: []
    };
    if (typeof section?.reason === 'string' && section.reason.trim()) {
      entry.reasons.push(section.reason.trim());
    }
    merged.set(sectionId, entry);
  }

  if (merged.size === 0) {
    return {
      text: buildNonDataContext(),
      fingerprint: JSON.stringify({
        tools: requestedTools,
        domainKnowledge: requestedKnowledge
      }),
      hasData: false,
      hasToolRequest,
      hasKnowledgeRequest
    };
  }

  const blocks = [`CONTEXT - Requested mainTree data (User: ${displayName})`];
  const fingerprintEntries = [];
  let hasData = false;
  for (const entry of merged.values()) {
    const rawData = (mainTree || {})[entry.sectionId];
    let data = rawData === null || rawData === undefined ? rawData : pruneNullish(rawData);
    data = normalizeDatesForLLM(entry.sectionId, data);
    if (hasMeaningfulValue(data)) hasData = true;
    const payload = {
      sectionId: entry.sectionId,
      ...(entry.reasons.length ? { reasons: entry.reasons } : {}),
      data
    };
    blocks.push(
      `<DATA:${entry.sectionId}>\n${JSON.stringify(payload)}\n</DATA:${entry.sectionId}>`
    );
    fingerprintEntries.push({
      sectionId: entry.sectionId,
      data
    });
  }

  const fingerprint = JSON.stringify({
    tools: requestedTools,
    domainKnowledge: requestedKnowledge,
    data: fingerprintEntries
  });
  return {
    text: blocks.join('\n\n'),
    fingerprint,
    hasData,
    hasToolRequest: requestedTools.length > 0,
    hasKnowledgeRequest: requestedKnowledge.length > 0
  };
};

/* ---------- helpers ---------- */

/** Map an OKRT action to a concise, human-readable label for UI buttons; called by normalizeActions. */
// PSEUDOCODE: infer noun/type from payload and map intent to a label string.
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
  if (intent === 'SHARE_OKRT') return 'Share Objective';
  if (intent === 'UNSHARE_OKRT') return 'Unshare Objective';
  return `${method || 'POST'} ${noun}`;
}

/** Normalize raw OKRT actions into stable UI-friendly objects with endpoints and labels; called in sendMessage on actions chunks. */
// PSEUDOCODE: map raw actions to UI objects with keys, labels, endpoints, and bodies.
function normalizeActions(rawActions = []) {
  return rawActions.map((a, idx) => {
    const idFromPayload = a?.payload?.id;
    const baseEndpoint = a?.endpoint?.includes('[id]')
      ? a.endpoint.replace('[id]', idFromPayload || '')
      : a?.endpoint || '/api/okrt';
    const needsShareQuery =
      a?.method === 'DELETE' &&
      baseEndpoint.includes('/share') &&
      a?.payload?.target &&
      a?.payload?.share_type;
    const endpoint = needsShareQuery
      ? `${baseEndpoint}?target=${encodeURIComponent(a.payload.target)}&type=${encodeURIComponent(a.payload.share_type)}`
      : baseEndpoint;
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

/** Render action rows with per-action acceptance and a bulk "Accept All" option; rendered by Message. */
// PSEUDOCODE: build a table of action rows, disable as needed, and wire callbacks.
function ActionButtons({ actions, okrtById, onActionClick, onRunAll }) {
  if (!actions || actions.length === 0) return null;
  const [descriptions, setDescriptions] = useState({});
  const [disabledButtons, setDisabledButtons] = useState({});
  const [acceptAllDisabled, setAcceptAllDisabled] = useState(false);

  useEffect(() => {
    /** Resolve descriptive labels for PUT/DELETE actions based on cached OKRT data; runs in useEffect on actions change. */
    // PSEUDOCODE: for each action, lookup OKRT and set a friendly description.
    const fetchDescriptions = async () => {
      const newDescriptions = {};
      for (const action of actions) {
        if ((action.method === 'PUT' || action.method === 'DELETE') && action.body?.id) {
          const okrt = okrtById.get(String(action.body.id));
          if (okrt) {
            let typeLabel = 'OKRT';
            if (okrt.type === 'T') typeLabel = 'Task';
            else if (okrt.type === 'K') typeLabel = 'KR';
            else if (okrt.type === 'O') typeLabel = 'Objective';

            const content = okrt.type === 'O' ? okrt.title : okrt.description;
            newDescriptions[action.key] = `${action.method === 'PUT' ? 'Update' : 'Delete'} ${typeLabel}: ${content || 'Untitled'}`;
          }
        }
      }
      setDescriptions(newDescriptions);
    };
    fetchDescriptions();
  }, [actions]);

  /** Disable a clicked action and forward it to the parent handler; called by Accept button onClick. */
  // PSEUDOCODE: mark button disabled and call parent handler.
  const handleActionClick = (action) => {
    setDisabledButtons(prev => ({ ...prev, [action.key]: true }));
    onActionClick(action);
  };

  /** Disable buttons and invoke the bulk action handler; called by Accept All onClick. */
  // PSEUDOCODE: disable all buttons, then call parent bulk handler.
  const handleRunAll = () => {
    setAcceptAllDisabled(true);
    // Disable all individual buttons as well
    const allDisabled = {};
    actions.forEach(action => {
      allDisabled[action.key] = true;
    });
    setDisabledButtons(allDisabled);
    onRunAll();
  };

  return (
    <table className={styles.actionButtons}>
      <tbody>
        {actions.map((action) => {
          let description = '';
          if (action.method === 'POST') {
            if (action.body?.type === 'O') description = `Create Objective: ${action.body?.title || ''}`;
            else if (action.body?.type === 'K') description = `Create KR: ${action.body?.description || ''}`;
            else if (action.body?.type === 'T') description = `Create Task: ${action.body?.description || ''}`;
            else if (action.intent === 'SHARE_OKRT') {
              description = action.body?.visibility === 'private'
                ? 'Unshare Objective (make private)'
                : 'Share Objective';
            } else if (action.intent === 'UNSHARE_OKRT') {
              description = action.body?.visibility === 'private'
                ? 'Unshare Objective (make private)'
                : 'Unshare Objective';
            }
          } else if (action.method === 'PUT' || action.method === 'DELETE') {
            description =
              descriptions[action.key] ||
              `${action.method === 'PUT' ? 'Update' : 'Delete'} ${action.body?.title || action.body?.description || 'OKRT'}`;
            if (action.intent === 'UNSHARE_OKRT') {
              description = 'Unshare Objective';
            }
          }
          return (
            <tr key={action.key}>
              <td>{description}</td>
              <td>
                <button
                  className={styles.actionButton}
                  onClick={() => handleActionClick(action)}
                  title={JSON.stringify(action.body || {}, null, 2)}
                  disabled={disabledButtons[action.key] || acceptAllDisabled}
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
                onClick={handleRunAll}
                title="Execute all actions in order"
                disabled={acceptAllDisabled}
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

/** Render a single chat message, including actions, loading states, and errors; rendered by AimePage. */
// PSEUDOCODE: choose user/assistant styles, render markdown, and show actions/spinners/errors.
function Message({ message, okrtById, onActionClick, onRunAll, onRetry, onQuickReply }) {
  const isUser = message.role === 'user';
  const textOnly = message.content;
  const charts = Array.isArray(message.charts) ? message.charts : [];
  const hasCharts = !isUser && charts.length > 0;

  return (
    <div className={`${styles.message} ${isUser ? styles.userMessage : styles.assistantMessage}`}>
      <div className={`${styles.messageContent} ${hasCharts ? styles.chartMessageContent : ''}`}>
        {!isUser && <span className={styles.assistantAvatar} aria-hidden="true" />}
        {message.error ? (
          <div className={styles.errorMessage}>
            <p>{textOnly}</p>
            <button className={styles.retryButton} onClick={onRetry}>Retry</button>
          </div>
        ) : (
          <>
            {/* Render Markdown nicely */}
            <MessageMarkdown>{textOnly}</MessageMarkdown>

            {!isUser && charts.length > 0 && (
              <div>
                {charts.map((chart, index) => (
                  <AimeChart key={`${message.id}-chart-${index}`} payload={chart} />
                ))}
              </div>
            )}

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
                okrtById={okrtById}
                onActionClick={onActionClick}
                onRunAll={onRunAll}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

/** Provide the Aime chat experience with streaming responses, actions, and TTS; rendered by Next.js for /aime. */
// PSEUDOCODE: wire stores/hooks, handle chat flow, and render the UI.
export default function AimePage() {
  const router = useRouter();
  const {
    messages,
    addMessage,
    updateMessage,
    isLoading,
    setLoading,
    pendingMessage,
    setPendingMessage,
    clearMessages
  } = useAimeStore();
  const lastPendingIdRef = useRef(null);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const [chatWidth, setChatWidth] = useState(null);
  const inputRef = useRef(null);
  
  // Use cached user data
  const { user, isLoading: userLoading } = useUser();
  
  // Subscribe to mainTreeStore to get all OKRTs and store actions
  const { mainTree, refreshMainTree } = useMainTree();
  const { myOKRTs } = mainTree;
  const okrtById = useMemo(
    () => new Map((myOKRTs || []).map((okrt) => [String(okrt.id), okrt])),
    [myOKRTs]
  );
  const preferredVoice = mainTree?.preferences?.preferred_voice;
  const { addMyOKRT, updateMyOKRT, removeMyOKRT, setLLMActivity } = useMainTreeStore();
  
  // Text-to-Speech hook
  const { isTTSEnabled, isSpeaking, needsUserGesture, toggleTTS, speak } = useTextToSpeech(preferredVoice);
  
  // Voice-to-text: microphone capture + transcription callback.
  const { isRecording, isProcessing, handleMicrophoneClick } = useVoiceInput({
    setInput,
    inputRef
  });

  /** Keep the chat scrolled to the newest message; called by useEffect on visibleMessages. */
  // PSEUDOCODE: scroll the end marker into view.
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  const visibleMessages = useMemo(() => messages.filter((message) => !message.hidden), [messages]);
  useEffect(() => { scrollToBottom(); }, [visibleMessages]);
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const updateWidth = () => setChatWidth(container.clientWidth || null);
    updateWidth();
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateWidth());
      observer.observe(container);
      return () => observer.disconnect();
    }
    const handleResize = () => updateWidth();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  useEffect(() => {
    if (!isLoading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLoading]);

  useEffect(() => {
    if (!pendingMessage?.text || isLoading) return;
    if (pendingMessage.id && pendingMessage.id === lastPendingIdRef.current) return;
    lastPendingIdRef.current = pendingMessage.id || pendingMessage.text;
    sendMessage(pendingMessage.text);
    setPendingMessage(null);
  }, [pendingMessage, isLoading]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

  const abortControllerRef = useRef(null);
  const stopRequestedRef = useRef(false);
  const lastPromptFingerprintRef = useRef('');
  const autoRetryCountRef = useRef(0);
  const duplicateReqMoreInfoRef = useRef(0);
  const reqMoreInfoErrorRetryRef = useRef(0);
  const accumulatedReqMoreInfoRef = useRef({
    sections: new Map(),
    knowledgeIds: new Set(),
    toolIds: new Set()
  });
  const INVALID_REQ_MORE_INFO_MESSAGE =
    'Sorry, I could not process the req_more_info tool call because its arguments were invalid. Please retry.';

  /** Send a user message to the backend, stream responses, and handle retries/actions; called by submit/key/quick-reply/retry flows. */
  // PSEUDOCODE: push user message, POST to API, stream response, handle actions and retries.
  const sendMessage = async (messageContent = input, options = {}) => {
    const trimmedContent = messageContent.trim();
    const {
      skipAddUserMessage = false,
      messageHistoryOverride = null,
      systemPromptData = '',
      forceSend = false
    } = options;
    if (!trimmedContent || (isLoading && !forceSend)) return;
    stopRequestedRef.current = false;

    const useOverride = Array.isArray(messageHistoryOverride);
    let outboundMessages = messageHistoryOverride;
    let userMessage = null;

    if (!useOverride && !skipAddUserMessage) {
      userMessage = {
        id: Date.now(),
        role: 'user',
        content: trimmedContent,
        timestamp: new Date(),
      };
      addMessage(userMessage);
      lastPromptFingerprintRef.current = '';
      autoRetryCountRef.current = 0;
      duplicateReqMoreInfoRef.current = 0;
      reqMoreInfoErrorRetryRef.current = 0;
      outboundMessages = [...messages, userMessage];
    }

    if (!useOverride && skipAddUserMessage) {
      outboundMessages = messages;
    }

    if (!skipAddUserMessage && !useOverride) {
      setInput('');
    }

    setLoading(true);
    setLLMActivity(true);

    try {
      const displayName = user?.displayName || 'User';
      // LLM step 2: call the backend LLM route with messages + prompt data.
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const requestPayload = {
        messages: (outboundMessages || []).slice(-10),
        systemPromptData,
        displayName
      };
      console.log('[AIME] /api/aime payload:', requestPayload);
      const response = await fetch('/api/aime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let assistantMessageId = null;
      /** Ensure a placeholder assistant message exists before streaming content. */
      /** Ensure a placeholder assistant message exists before streaming content; called by stream handlers. */
      // PSEUDOCODE: create assistant message once and return its id.
      const ensureAssistantMessage = () => {
        if (assistantMessageId) return assistantMessageId;
        assistantMessageId = Date.now() + 1;
        addMessage({
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          actions: [],
          timestamp: new Date(),
        });
        return assistantMessageId;
      };

      let textBuffer = '';
      let pendingActions = [];
      let pendingCharts = [];
      let pendingReqMoreInfo = null;
      let chunkBuffer = '';

      const TTS_CHUNK_THRESHOLD = 400; // characters
      /** Flush accumulated text into the TTS queue when it is long or sentence-complete. */
      /** Flush accumulated text into the TTS queue when it is long or sentence-complete; called per content chunk. */
      // PSEUDOCODE: if chunkBuffer is long or ends a sentence, call speak and clear.
      const flushChunkIfReady = () => {
        if (!isTTSEnabled) return;
        const trimmed = chunkBuffer.trim();
        if (!trimmed) return;
        // Prefer to flush when we hit punctuation and have a reasonable length
        const hasSentenceEnd = /[\\.\\?!]$/.test(trimmed);
        if (trimmed.length >= TTS_CHUNK_THRESHOLD || (hasSentenceEnd && trimmed.length >= 120)) {
          speak(trimmed);
          chunkBuffer = '';
        }
      };

      // LLM step 3: stream response chunks and update the UI as text arrives.
      while (true) {
        if (stopRequestedRef.current) break;
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter((l) => l.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.type === 'content') {
              const id = ensureAssistantMessage();
              textBuffer += data.data;
              updateMessage(id, { content: textBuffer });
              chunkBuffer += data.data;
              flushChunkIfReady();
              console.log('[AIME] stream content chunk received:', data);
            } else if (data.type === 'preparing_actions') {
              const id = ensureAssistantMessage();
              updateMessage(id, { content: textBuffer, preparingActions: true });
              console.log('[AIME] stream preparing_actions received:', data);
            } else if (data.type === 'actions') {
              const id = ensureAssistantMessage();
              pendingActions = normalizeActions(data.data || []);
              updateMessage(id, {
                content: textBuffer,
                preparingActions: false,
                processingActions: false,
                actions: pendingActions
              });
              console.log('[AIME] stream actions received:', data);
            } else if (data.type === 'chart') {
              const id = ensureAssistantMessage();
              pendingCharts = [...pendingCharts, data.data].filter(Boolean);
              updateMessage(id, { content: textBuffer, charts: pendingCharts });
              console.log('[AIME] stream chart received:', data);
            } else if (data.type === 'req_more_info') {
              pendingReqMoreInfo = data.data;
              console.log('[AIME] stream req_more_info received:', data);
            } else if (data.type === 'done') {
              // no-op
              console.log('[AIME] stream done received:', data);
            }
          } catch (e) {
            console.error('Stream parse error:', e, 'Line was:', line);
          }
        }
      }

      if (assistantMessageId) {
        const finalUpdate = { content: textBuffer, preparingActions: false };
        if (pendingActions.length > 0) finalUpdate.actions = pendingActions;
        if (pendingCharts.length > 0) finalUpdate.charts = pendingCharts;
        updateMessage(assistantMessageId, finalUpdate);
      }

      const hasInvalidReqMoreInfo =
        textBuffer.includes(INVALID_REQ_MORE_INFO_MESSAGE);
      const shouldAutoRetryInvalidReqMoreInfo =
        hasInvalidReqMoreInfo &&
        !pendingReqMoreInfo &&
        pendingActions.length === 0 &&
        !stopRequestedRef.current &&
        reqMoreInfoErrorRetryRef.current < 1;
      if (shouldAutoRetryInvalidReqMoreInfo) {
        reqMoreInfoErrorRetryRef.current += 1;
        const errorNotice =
          'SYSTEM NOTICE: Empty or invalid req_more_info received. Do not call req_more_info again; answer using available context.';
        const nextSystemPromptData = systemPromptData
          ? `${systemPromptData}\n\n${errorNotice}`
          : errorNotice;
        await sendMessage(trimmedContent, {
          skipAddUserMessage: true,
          messageHistoryOverride: outboundMessages,
          systemPromptData: nextSystemPromptData,
          forceSend: true
        });
        return;
      }
      
      // Flush any remaining chunk after stream ends
      if (isTTSEnabled && assistantMessageId) {
        const remaining = chunkBuffer.trim();
        if (remaining) {
          speak(remaining);
        }
      }

      if (pendingReqMoreInfo && !stopRequestedRef.current) {
        mergeReqMoreInfo(accumulatedReqMoreInfoRef.current, pendingReqMoreInfo);
        const mergedReqMoreInfo = buildMergedReqMoreInfo(accumulatedReqMoreInfoRef.current);
        const reqMoreInfoMessage = {
          id: Date.now() + 2,
          role: 'assistant',
          content: '',
          reqMoreInfo: mergedReqMoreInfo,
          hidden: true,
          timestamp: new Date(),
        };
        addMessage(reqMoreInfoMessage);
        const nextMessages = [...(outboundMessages || []), reqMoreInfoMessage];
        const nextPayload = buildSystemPromptPayload(
          mergedReqMoreInfo,
          mainTree || {},
          displayName
        );
        const needsChartWidth =
          Array.isArray(mergedReqMoreInfo?.domainKnowledge?.ids) &&
          mergedReqMoreInfo.domainKnowledge.ids.includes('aime-charts');
        const widthHint = needsChartWidth && Number.isFinite(chatWidth)
          ? `\n\nCHAT_WINDOW_WIDTH_PX: ${Math.round(chatWidth)}`
          : '';
        const maxRetries = nextPayload.hasData ? 2 : 4;
        const exceededRetries = autoRetryCountRef.current >= maxRetries;
        const shouldCheckDuplicate = nextPayload.hasData;
        const isDuplicate =
          shouldCheckDuplicate &&
          nextPayload.fingerprint &&
          nextPayload.fingerprint === lastPromptFingerprintRef.current;
        const shouldRetry =
          nextPayload.hasData || nextPayload.hasToolRequest || nextPayload.hasKnowledgeRequest;
        const shouldWarnDuplicate =
          nextPayload.hasData && isDuplicate && duplicateReqMoreInfoRef.current === 0;
        const shouldBlockForDuplicate = nextPayload.hasData && isDuplicate && !shouldWarnDuplicate;
        const shouldBlockForRetries = exceededRetries;
        if (!shouldRetry || shouldBlockForDuplicate || shouldBlockForRetries) {
          addMessage({
            id: Date.now() + 3,
            role: 'assistant',
            content: 'I requested more context, but no new data was available. Please refine your request.',
            timestamp: new Date(),
          });
        } else {
          autoRetryCountRef.current += 1;
          if (shouldWarnDuplicate) {
            duplicateReqMoreInfoRef.current += 1;
          }
          lastPromptFingerprintRef.current = nextPayload.fingerprint;
          const duplicateNotice = shouldWarnDuplicate
            ? 'SYSTEM NOTICE: The previous req_more_info requested sections already present in CONTEXT. Do not call req_more_info again unless new sections are missing; answer using existing context.'
            : '';
          const systemPromptData = duplicateNotice
            ? `${nextPayload.text}\n\n${duplicateNotice}${widthHint}`
            : `${nextPayload.text}${widthHint}`;
          await sendMessage(trimmedContent, {
            skipAddUserMessage: true,
            messageHistoryOverride: nextMessages,
            systemPromptData,
            forceSend: true
          });
        }
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        // User stopped the stream.
      } else {
        console.error('Error sending message:', error);
        addMessage({
          id: Date.now() + 1,
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          error: true,
          timestamp: new Date(),
        });
      }
    } finally {
      setLoading(false);
      setLLMActivity(false);
    }
  };

  /** Stop the current streaming response and log the interruption in chat; called by Stop button onClick. */
  // PSEUDOCODE: set stop flag, abort fetch, and add a stop message.
  const handleStop = () => {
    if (!isLoading) return;
    stopRequestedRef.current = true;
    abortControllerRef.current?.abort();
    addMessage({
      id: Date.now(),
      role: 'user',
      content: 'User pressed Stop button',
      timestamp: new Date(),
    });
  };

  /** Execute a single suggested action and sync any cache updates; called from ActionButtons via Message. */
  // PSEUDOCODE: validate action, POST to API, apply cache updates, add status message.
  const handleActionClick = async (action) => {
    setLoading(true);
    try {
      if ((action.method === 'PUT' || action.method === 'DELETE') && action.body?.id) {
        const id = String(action.body.id);
        if (!okrtById.has(id)) {
          addMessage({
            id: Date.now() + 1,
            role: 'assistant',
            content: 'That action looks stale (item not found in your current OKRTs). Please refresh and try again.',
            error: true,
            timestamp: new Date(),
          });
          return;
        }
      }
      const payload = { ...action.body };
      const res = await fetch(action.endpoint, {
        method: action.method,
        headers: { 'Content-Type': 'application/json' },
        body: action.method === 'DELETE' ? undefined : JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      
      const result = await res.json();
      
      let appliedCacheUpdate = false;
      // Handle cache update if provided by the API
      if (result._cacheUpdate) {
        const { action: cacheAction, data } = result._cacheUpdate;
        
        if (cacheAction === 'addMyOKRT' && data) {
          addMyOKRT(data);
          appliedCacheUpdate = true;
        } else if (cacheAction === 'updateMyOKRT' && data?.id && data?.updates) {
          updateMyOKRT(data.id, data.updates);
          appliedCacheUpdate = true;
        } else if (cacheAction === 'removeMyOKRT' && data?.id) {
          removeMyOKRT(data.id);
          appliedCacheUpdate = true;
        }
      }

      if (
        !appliedCacheUpdate &&
        (action.intent === 'SHARE_OKRT' || action.intent === 'UNSHARE_OKRT') &&
        action.body?.id &&
        action.body?.visibility
      ) {
        const visibility = action.body.visibility;
        const sharedGroups =
          visibility === 'shared'
            ? (result?.shared_groups || action.body?.shared_groups || action.body?.sharedGroups || [])
            : [];
        updateMyOKRT(action.body.id, { visibility, shared_groups: sharedGroups });
      }
      
      if (action.intent === 'SHARE_OKRT' || action.intent === 'UNSHARE_OKRT') {
        await refreshMainTree();
      }
      addMessage({ id: Date.now(), role: 'assistant', content: `✅ ${action.label} completed successfully!`, timestamp: new Date() });
    } catch (err) {
      console.error('Action error:', err);
      addMessage({ id: Date.now(), role: 'assistant', content: `❌ Failed to execute "${action.label}". ${err.message}`, error: true, timestamp: new Date() });
    } finally {
      setLoading(false);
    }
  };

  /** Execute suggested actions sequentially and update caches as results arrive; called from ActionButtons via Message. */
  // PSEUDOCODE: loop actions, POST each, update cache, then report success/failure.
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
        
        const result = await res.json();
        
        let appliedCacheUpdate = false;
        // Handle cache update if provided by the API
        if (result._cacheUpdate) {
          const { action: cacheAction, data } = result._cacheUpdate;
          
          if (cacheAction === 'addMyOKRT' && data) {
            addMyOKRT(data);
            appliedCacheUpdate = true;
          } else if (cacheAction === 'updateMyOKRT' && data?.id && data?.updates) {
            updateMyOKRT(data.id, data.updates);
            appliedCacheUpdate = true;
          } else if (cacheAction === 'removeMyOKRT' && data?.id) {
            removeMyOKRT(data.id);
            appliedCacheUpdate = true;
          }
        }

        if (
          !appliedCacheUpdate &&
          (action.intent === 'SHARE_OKRT' || action.intent === 'UNSHARE_OKRT') &&
          action.body?.id &&
          action.body?.visibility
        ) {
          const visibility = action.body.visibility;
          const sharedGroups =
            visibility === 'shared'
              ? (result?.shared_groups || action.body?.shared_groups || action.body?.sharedGroups || [])
              : [];
          updateMyOKRT(action.body.id, { visibility, shared_groups: sharedGroups });
        }
      }
      if (actions.some((action) => action.intent === 'SHARE_OKRT' || action.intent === 'UNSHARE_OKRT')) {
        await refreshMainTree();
      }
      addMessage({ id: Date.now(), role: 'assistant', content: `✅ All actions completed successfully!`, timestamp: new Date() });
    } catch (err) {
      console.error('Run All error:', err);
      addMessage({ id: Date.now(), role: 'assistant', content: `❌ Failed while executing actions. ${err.message}`, error: true, timestamp: new Date() });
    } finally {
      setLoading(false);
    }
  };

  /** Retry the last user message by resending it through the chat flow; called by Message error UI. */
  // PSEUDOCODE: find last user message and call sendMessage with its content.
  const handleRetry = () => {
    const lastUserMessage = messages.filter((m) => m.role === 'user').pop();
    if (lastUserMessage) sendMessage(lastUserMessage.content);
  };

  /** Reset chat state to the initial prompt-only baseline; called by Reset button onClick. */
  // PSEUDOCODE: abort any stream, clear store messages, reset refs, and clear input.
  const handleReset = () => {
    stopRequestedRef.current = true;
    abortControllerRef.current?.abort();
    clearMessages();
    setPendingMessage(null);
    setLoading(false);
    setLLMActivity(false);
    setInput('');
    lastPendingIdRef.current = null;
    lastPromptFingerprintRef.current = '';
    autoRetryCountRef.current = 0;
    duplicateReqMoreInfoRef.current = 0;
    accumulatedReqMoreInfoRef.current = {
      sections: new Map(),
      knowledgeIds: new Set(),
      toolIds: new Set()
    };
  };

  /** Intercept form submit to send the current input as a chat message; called by form onSubmit. */
  // PSEUDOCODE: prevent default submit and call sendMessage.
  const handleSubmit = (e) => { e.preventDefault(); sendMessage(); };
  /** Send on Enter while allowing Shift+Enter for newlines; called by textarea onKeyPress. */
  // PSEUDOCODE: if Enter without Shift, prevent default and send message.
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  /** Dispatch a canned quick-reply message; called by Message quick-reply UI. */
  // PSEUDOCODE: call sendMessage with the quick reply text.
  const handleQuickReply = (text) => sendMessage(text);

  return (
    <div className="app-page">
      <div className={`app-pageContent app-pageContent--full ${styles.container}`}>


      <div className={styles.messagesContainer} ref={messagesContainerRef}>
        {visibleMessages.length === 0 && (
          <div className={styles.welcomeMessage}>
            <div className={styles.coachAvatar}>
              <span className={styles.coachImage} role="img" aria-label="Aime2" />
            </div>
            <p>Hi! I'm Aime, your OKRT coach. I can help you create objectives, key results, and tasks. What would you like to work on today?</p>
          </div>
        )}

        {visibleMessages.map((message) => (
          <Message
            key={message.id}
            message={message}
            okrtById={okrtById}
            onActionClick={handleActionClick}
            onRunAll={() => handleRunAll(message.actions || [])}
            onRetry={handleRetry}
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
          <button
            type="button"
            className={`${styles.micButton} ${isRecording ? styles.micButtonRecording : ''}`}
            onClick={handleMicrophoneClick}
            disabled={isLoading || isProcessing}
            title={isRecording ? 'Stop recording' : 'Start voice input'}
          >
            {isProcessing ? (
              <span className={styles.micProcessing}>⏳</span>
            ) : isRecording ? (
              <span className={styles.micRecording}>🔴</span>
            ) : (
              <TiMicrophoneOutline className={styles.micIcon} size={24} />
            )}
          </button>
          <button
            type="button"
            className={`${styles.speakerButton} ${isTTSEnabled ? styles.speakerButtonEnabled : ''} ${isSpeaking ? styles.speakerButtonSpeaking : ''}`}
            onClick={toggleTTS}
            disabled={isLoading}
            title={
              needsUserGesture
                ? 'Tap to enable audio playback'
                : isTTSEnabled
                  ? 'Disable text-to-speech'
                  : 'Enable text-to-speech'
            }
          >
            {isSpeaking ? (
              <PiSpeakerHighBold className={styles.speakerSpeaking} size={24} />
            ) : isTTSEnabled ? (
              <PiSpeakerHighBold className={styles.speakerEnabled} size={24} />
            ) : (
              <PiSpeakerSlash className={styles.speakerDisabled} size={24} />
            )}
          </button>
          <div className={styles.textareaWrapper}>
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
            <button
              type="button"
              className={styles.resetButton}
              onClick={handleReset}
              title="Reset conversation"
              aria-label="Reset conversation"
            >
              R
            </button>
            <button
              type="button"
              className={`${styles.stopButton} ${isLoading ? styles.stopButtonActive : ''}`}
              onClick={handleStop}
              title="Stop response"
              aria-label="Stop response"
              disabled={!isLoading}
            >
              <span className={styles.stopIcon} aria-hidden="true" />
            </button>
            <button
              type="submit"
              className={styles.mobileSendButton}
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
            >
              <SlArrowUpCircle size={32} />
            </button>
          </div>
          <button type="submit" className={styles.sendButton} disabled={isLoading || !input.trim()}>
            Send
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
