'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCoach } from '@/contexts/CoachContext';
import { useUser } from '@/hooks/useUser';
import useMainTreeStore from '@/store/mainTreeStore';
import { useMainTree } from '@/hooks/useMainTree';
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
function useVoiceRecording(onTranscriptionComplete) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const monitorIntervalRef = useRef(null);
  const silenceTimeoutRef = useRef(null);
  const lastSoundTimeRef = useRef(0);
  const recordingStartTimeRef = useRef(0);
  const stopRequestedRef = useRef(false);

  const SILENCE_RMS_THRESHOLD = 0.015; // Normalized RMS threshold for silence
  const SILENCE_DURATION_MS = 2000; // Minimum silence to start stop flow
  const POST_SILENCE_GRACE_MS = 600; // Extra padding after silence before stopping
  const POST_STOP_GRACE_MS = 300; // Let MediaRecorder flush the final chunk
  const MAX_RECORDING_MS = 60000; // Safety cap to stop very long recordings

  const playBing = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.9, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
      osc.onended = () => ctx.close();
    } catch (err) {
      console.error('Unable to play chime:', err);
    }
  };

  const checkAudioLevel = () => {
    if (!analyserRef.current) return;

    const bufferLength = analyserRef.current.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(dataArray);

    // Root mean square gives a stable measure of loudness
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      const sample = (dataArray[i] - 128) / 128; // Normalize to [-1, 1]
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / bufferLength);

    const now = Date.now();
    if (rms > SILENCE_RMS_THRESHOLD) {
      lastSoundTimeRef.current = now;
      // Cancel any pending silence stop if user speaks again
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    } else if (now - lastSoundTimeRef.current >= SILENCE_DURATION_MS) {
      // Schedule a padded stop so trailing words are captured
      if (!silenceTimeoutRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          stopRecording('silence');
        }, POST_SILENCE_GRACE_MS);
      }
    }

    // Safety stop if recording somehow keeps running
    if (now - recordingStartTimeRef.current >= MAX_RECORDING_MS) {
      stopRecording('timeout');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      recordingStartTimeRef.current = Date.now();
      lastSoundTimeRef.current = Date.now();
      stopRequestedRef.current = false;

      // Set up audio analysis for silence detection
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 2048;

      // Start monitoring audio levels
      monitorIntervalRef.current = setInterval(checkAudioLevel, 100);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (monitorIntervalRef.current) {
          clearInterval(monitorIntervalRef.current);
          monitorIntervalRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const blobSize = audioBlob.size;
        if (blobSize === 0) {
          console.warn('Recording produced empty blob');
        }
        
        // Clean up
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }

        // Send to API
        setIsProcessing(true);
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

          const response = await fetch('/api/speech-to-text', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error('Failed to transcribe audio');
          }

          const result = await response.json();
          
          // Call the callback with transcribed text
          if (onTranscriptionComplete) {
            onTranscriptionComplete(result.text);
          }
        } catch (error) {
          console.error('Transcription error:', error);
          if (onTranscriptionComplete) {
            onTranscriptionComplete('');
          }
        } finally {
          setIsProcessing(false);
          stopRequestedRef.current = false;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = (reason = 'manual') => {
    if (stopRequestedRef.current) return;
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      stopRequestedRef.current = true;
      if (reason !== 'manual') {
        playBing();
      }
      // Give the recorder a short grace period so the final chunk flushes
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      setTimeout(() => {
        recorder.stop();
        setIsRecording(false);
      }, POST_STOP_GRACE_MS);
    }
  };

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording
  };
}

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
  const [descriptions, setDescriptions] = useState({});
  const [disabledButtons, setDisabledButtons] = useState({});
  const [acceptAllDisabled, setAcceptAllDisabled] = useState(false);

  useEffect(() => {
    const fetchDescriptions = async () => {
      const newDescriptions = {};
      for (const action of actions) {
        if ((action.method === 'PUT' || action.method === 'DELETE') && action.body?.id) {
          const okrt = await fetchOKRTById(action.body.id);
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

/* ---------- helpers for API ---------- */

async function fetchOKRTById(id) {
 try {
   const res = await fetch(`/api/okrt/${id}`, {
     method: 'GET',
     headers: { 'Content-Type': 'application/json' },
   });
   if (!res.ok) {
     throw new Error(`Failed to fetch OKRT with id ${id}. Status: ${res.status}`);
   }
   const data = await res.json();
   return data?.okrt || null;
 } catch (err) {
   console.error('fetchOKRTById error:', err);
   return null;
 }
}

/* ---------- Page ---------- */

export default function CoachPage() {
  const router = useRouter();
  const { messages, addMessage, updateMessage, isLoading, setLoading } = useCoach();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Use cached user data
  const { user, isLoading: userLoading } = useUser();
  
  // Subscribe to mainTreeStore to get all OKRTs and store actions
  const { mainTree } = useMainTree();
  const { myOKRTs } = mainTree;
  const preferredVoice = mainTree?.preferences?.preferred_voice;
  const { addMyOKRT, updateMyOKRT, removeMyOKRT, setLLMActivity } = useMainTreeStore();
  
  // Text-to-Speech hook
  const { isTTSEnabled, isSpeaking, needsUserGesture, toggleTTS, speak } = useTextToSpeech(preferredVoice);
  
  // Voice recording hook with callback
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

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!userLoading && !user) {
      router.push('/login');
    }
  }, [user, userLoading, router]);

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
    setLLMActivity(true);

    try {
      // Prepare OKRT context from mainTreeStore
      const okrtContext = {
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

  const handleFormSubmit = async (endpoint, method, data) => {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'DELETE' ? undefined : JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      
      const result = await res.json();
      
      // Handle cache update if provided by the API
      if (result._cacheUpdate) {
        const { action: cacheAction, data: cacheData } = result._cacheUpdate;
        
        if (cacheAction === 'addMyOKRT' && cacheData) {
          addMyOKRT(cacheData);
        } else if (cacheAction === 'updateMyOKRT' && cacheData?.id && cacheData?.updates) {
          updateMyOKRT(cacheData.id, cacheData.updates);
        } else if (cacheAction === 'removeMyOKRT' && cacheData?.id) {
          removeMyOKRT(cacheData.id);
        }
      }
      
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
    <div className={styles.container}>


      <div className={styles.messagesContainer}>
        {messages.length === 0 && (
          <div className={styles.welcomeMessage}>
            <div className={styles.coachAvatar}>
              <img src="/coach.png" alt="Coach" className={styles.coachImage} />
            </div>
            <p>Hi! I'm Aime, your OKRT coach. I can help you create objectives, key results, and tasks. What would you like to work on today?</p>
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
  );
}
