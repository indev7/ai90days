'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCoach } from '@/contexts/CoachContext';
import { useUser } from '@/hooks/useUser';
import useMainTreeStore from '@/store/mainTreeStore';
import { useMainTree } from '@/hooks/useMainTree';
import useVoiceRecording from '@/hooks/useVoiceRecording';
import styles from './page.module.css';
import OkrtPreview from '../../components/OkrtPreview';
import MessageMarkdown from '../../components/MessageMarkdown';
import { TiMicrophoneOutline } from "react-icons/ti";
import { PiSpeakerSlash, PiSpeakerHighBold } from "react-icons/pi";
import { SlArrowUpCircle } from "react-icons/sl";

/* ---------- Text-to-Speech Hook ---------- */
function useTextToSpeech(preferredVoice) {
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const audioRef = useRef(null);
  const audioQueueRef = useRef([]);
  const textQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const isFetchingRef = useRef(false);

  const toggleTTS = () => {
    if (isTTSEnabled && needsUserGesture) {
      primeAudio();
      return;
    }
    const nextEnabled = !isTTSEnabled;
    setIsTTSEnabled(nextEnabled);
    if (nextEnabled) {
      primeAudio();
    } else if (audioRef.current) {
      // Stop any current playback when disabling
      audioRef.current.pause();
      audioRef.current = null;
      audioQueueRef.current.forEach((item) => {
        try { URL.revokeObjectURL(item.url); } catch (_) {}
      });
      audioQueueRef.current = [];
      textQueueRef.current = [];
      isPlayingRef.current = false;
      isFetchingRef.current = false;
      setIsSpeaking(false);
    }
  };

  const SILENT_MP3_DATA_URL =
    'data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA' +
    'AWGluZwAAAA8AAAACAAACcQCA/////wAAACwAAAAAAABxAAACcQCAAWGluZwAAAA8AAAACAAAC' +
    'cQCA/////wAAACwAAAAAAABxAAACcQCA';

  const ensureAudioElement = () => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.playsInline = true;
      audioRef.current = audio;
    }
    return audioRef.current;
  };

  const primeAudio = async () => {
    try {
      const audio = ensureAudioElement();
      audio.muted = true;
      audio.src = SILENT_MP3_DATA_URL;
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      setNeedsUserGesture(false);
    } catch (error) {
      console.warn('[TTS] Audio unlock failed:', error);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.muted = false;
      }
      setNeedsUserGesture(true);
    }
  };

  const extractTextContent = (content) => {
    if (!content) return '';
    
    // Remove JSON blocks (tool outputs)
    let text = content.replace(/```json[\s\S]*?```/g, '');
    
    // Remove code blocks
    text = text.replace(/```[\s\S]*?```/g, '');
    
    // Remove inline code
    text = text.replace(/`[^`]+`/g, '');
    
    // Remove ACTION_HTML tags
    text = text.replace(/<ACTION_HTML>[\s\S]*?<\/ACTION_HTML>/g, '');
    
    // Remove markdown links but keep text
    text = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    
    // Remove markdown formatting
    text = text.replace(/[*_~#]/g, '');
    
    // Clean up extra whitespace
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
  };

  const processQueue = () => {
    if (isPlayingRef.current) return;
    const next = audioQueueRef.current.shift();
    if (!next) {
      setIsSpeaking(false);
      return;
    }

    isPlayingRef.current = true;
    setIsSpeaking(true);
    const audio = ensureAudioElement();
    audio.muted = false;
    audio.src = next.url;

    const handleDone = () => {
      URL.revokeObjectURL(next.url);
      isPlayingRef.current = false;
      // Continue with the next item in the queue
      processQueue();
    };

    audio.onended = handleDone;
    audio.onerror = () => {
      const mediaError = audio.error;
      console.error('[TTS] Audio playback error:', {
        code: mediaError?.code,
        message: mediaError?.message,
        src: audio.src,
        readyState: audio.readyState,
        networkState: audio.networkState
      });
      handleDone();
    };

    audio.oncanplaythrough = () => {
      audio.play().catch((err) => {
        console.error('[TTS] Audio play() failed:', err);
        if (err?.name === 'NotAllowedError') {
          setNeedsUserGesture(true);
          audio.pause();
          audio.currentTime = 0;
          audioQueueRef.current.unshift(next);
          isPlayingRef.current = false;
          setIsSpeaking(false);
          return;
        }
        handleDone();
      });
    };
    audio.load();
  };

  const speak = async (text) => {
    console.log('[TTS] speak called with:', {
      isTTSEnabled,
      preferredVoice,
      textLength: text?.length,
      text: text?.substring(0, 100)
    });
    
    if (!isTTSEnabled) {
      console.log('[TTS] TTS is disabled, skipping');
      return;
    }
    
    if (!text || text.trim().length === 0) {
      console.log('[TTS] No text provided, skipping');
      return;
    }

    const cleanText = extractTextContent(text);
    console.log('[TTS] Cleaned text:', cleanText.substring(0, 100));
    
    if (!cleanText || cleanText.length === 0) {
      console.log('[TTS] No clean text after extraction, skipping');
      return;
    }

    const voiceToUse = preferredVoice || 'alloy';

    const processTextQueue = async () => {
      if (isFetchingRef.current) return;
      const nextItem = textQueueRef.current.shift();
      if (!nextItem) return;
      isFetchingRef.current = true;

      try {
        console.log('[TTS] Fetching audio from API with voice:', nextItem.voice);
        
        const response = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: nextItem.text, model: 'tts-1', voice: nextItem.voice })
        });
  
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[TTS] API error:', response.status, errorText);
          throw new Error('Failed to generate speech');
        }
  
        console.log('[TTS] Audio received, creating blob...');
        const audioBlob = await response.blob();
        console.log('[TTS] Blob size:', audioBlob.size, 'type:', audioBlob.type);
        
        const audioUrl = URL.createObjectURL(audioBlob);
        console.log('[TTS] Audio URL created:', audioUrl);
        
        audioQueueRef.current.push({ url: audioUrl });
        console.log('[TTS] Enqueued audio. Queue length:', audioQueueRef.current.length);
        processQueue();
      } catch (error) {
        console.error('[TTS] Error:', error);
        if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
          setIsSpeaking(false);
        }
      } finally {
        isFetchingRef.current = false;
        // Continue with the next text in the queue
        if (textQueueRef.current.length > 0) {
          processTextQueue();
        }
      }
    };

    const enqueueText = () => {
      textQueueRef.current.push({ text: cleanText, voice: voiceToUse });
      processTextQueue();
    };

    enqueueText();
  };

  return {
    isTTSEnabled,
    isSpeaking,
    needsUserGesture,
    toggleTTS,
    speak
  };
}

/* ---------- Audio Recording Hook ---------- */
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

function ActionButtons({ actions, okrtById, onActionClick, onRunAll }) {
  if (!actions || actions.length === 0) return null;
  const [descriptions, setDescriptions] = useState({});
  const [disabledButtons, setDisabledButtons] = useState({});
  const [acceptAllDisabled, setAcceptAllDisabled] = useState(false);

  useEffect(() => {
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

  const handleActionClick = (action) => {
    setDisabledButtons(prev => ({ ...prev, [action.key]: true }));
    onActionClick(action);
  };

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
          } else if (action.method === 'PUT' || action.method === 'DELETE') {
            description =
              descriptions[action.key] ||
              `${action.method === 'PUT' ? 'Update' : 'Delete'} ${action.body?.title || action.body?.description || 'OKRT'}`;
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

function Message({ message, okrtById, onActionClick, onRunAll, onRetry, onQuickReply }) {
  const isUser = message.role === 'user';
  const textOnly = message.content;

  return (
    <div className={`${styles.message} ${isUser ? styles.userMessage : styles.assistantMessage}`}>
      <div className={styles.messageContent}>
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

export default function CoachPage() {
  const router = useRouter();
  const { messages, addMessage, updateMessage, isLoading, setLoading, pendingMessage, setPendingMessage } = useCoach();
  const lastPendingIdRef = useRef(null);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Use cached user data
  const { user, isLoading: userLoading } = useUser();
  
  // Subscribe to mainTreeStore to get all OKRTs and store actions
  const { mainTree } = useMainTree();
  const { myOKRTs } = mainTree;
  const okrtById = useMemo(
    () => new Map((myOKRTs || []).map((okrt) => [String(okrt.id), okrt])),
    [myOKRTs]
  );
  const preferredVoice = mainTree?.preferences?.preferred_voice;
  const { addMyOKRT, updateMyOKRT, removeMyOKRT, setLLMActivity } = useMainTreeStore();
  
  // Text-to-Speech hook
  const { isTTSEnabled, isSpeaking, needsUserGesture, toggleTTS, speak } = useTextToSpeech(preferredVoice);
  
  // Voice-to-text: microphone capture + transcription callback from useVoiceRecording
  const handleTranscription = (text) => {
    if (text && text.trim()) {
      setInput(text);
      // Focus the input so user can see and edit
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };
  
  const { isRecording, isProcessing, startRecording, stopRecording } = useVoiceRecording(handleTranscription);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => { scrollToBottom(); }, [messages]);

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

  const sendMessage = async (messageContent = input) => {
    if (!messageContent.trim() || isLoading) return;

    // LLM step 1: push user message into local chat state.
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: messageContent.trim(),
      timestamp: new Date(),
    };

    addMessage(userMessage);
    setInput('');
    setLoading(true);
    setLLMActivity(true);

    try {
      // LLM step 2: build OKRT context to send with the prompt.
      const displayName = user?.displayName || 'User';
      const okrtContext = {
        user: { displayName },
        objectives: myOKRTs.filter(okrt => okrt.type === 'O').map(obj => {
          const krs = myOKRTs.filter(okrt => okrt.type === 'K' && okrt.parent_id === obj.id);
          return {
            ...obj,
            krs: krs.map(kr => {
              const tasks = myOKRTs.filter(okrt => okrt.type === 'T' && okrt.parent_id === kr.id);
              return {
                ...kr,
                tasks
              };
            })
          };
        })
      };

      // LLM step 3: call the backend LLM route with messages + context.
      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].slice(-10),
          okrtContext // Send the OKRT context from mainTreeStore
        }),
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
      let chunkBuffer = '';

      const TTS_CHUNK_THRESHOLD = 400; // characters
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

      // LLM step 4: stream response chunks and update the UI as text arrives.
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
              chunkBuffer += data.data;
              flushChunkIfReady();
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
      
      // Flush any remaining chunk after stream ends
      if (isTTSEnabled) {
        const remaining = chunkBuffer.trim();
        console.log('[TTS] Stream complete, flushing remaining chunk:', remaining ? remaining.substring(0, 80) : '(none)');
        if (remaining) {
          speak(remaining);
        }
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
      setLLMActivity(false);
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
      
      const result = await res.json();
      
      // Handle cache update if provided by the API
      if (result._cacheUpdate) {
        const { action: cacheAction, data } = result._cacheUpdate;
        
        if (cacheAction === 'addMyOKRT' && data) {
          addMyOKRT(data);
        } else if (cacheAction === 'updateMyOKRT' && data?.id && data?.updates) {
          updateMyOKRT(data.id, data.updates);
        } else if (cacheAction === 'removeMyOKRT' && data?.id) {
          removeMyOKRT(data.id);
        }
      }
      
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
        
        const result = await res.json();
        
        // Handle cache update if provided by the API
        if (result._cacheUpdate) {
          const { action: cacheAction, data } = result._cacheUpdate;
          
          if (cacheAction === 'addMyOKRT' && data) {
            addMyOKRT(data);
          } else if (cacheAction === 'updateMyOKRT' && data?.id && data?.updates) {
            updateMyOKRT(data.id, data.updates);
          } else if (cacheAction === 'removeMyOKRT' && data?.id) {
            removeMyOKRT(data.id);
          }
        }
      }
      addMessage({ id: Date.now(), role: 'assistant', content: `✅ All actions completed successfully!`, timestamp: new Date() });
    } catch (err) {
      console.error('Run All error:', err);
      addMessage({ id: Date.now(), role: 'assistant', content: `❌ Failed while executing actions. ${err.message}`, error: true, timestamp: new Date() });
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

  const handleMicrophoneClick = () => {
    if (isRecording) {
      // Stop recording manually
      stopRecording('manual');
    } else {
      // Start recording
      startRecording();
    }
  };

  return (
    <div className="app-page">
      <div className={`app-pageContent app-pageContent--full ${styles.container}`}>


      <div className={styles.messagesContainer}>
        {messages.length === 0 && (
          <div className={styles.welcomeMessage}>
            <div className={styles.coachAvatar}>
              <span className={styles.coachImage} role="img" aria-label="Aime" />
            </div>
            <p>Hi! I'm Aime, your OKRT coach. I can help you create objectives, key results, and tasks. What would you like to work on today?</p>
          </div>
        )}

        {messages.map((message) => (
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
