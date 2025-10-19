'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCoach } from '@/contexts/CoachContext';
import styles from './page.module.css';
import OkrtPreview from '../../components/OkrtPreview';
import MessageMarkdown from '../../components/MessageMarkdown';
import { TiMicrophoneOutline } from "react-icons/ti";
import { PiSpeakerSlash, PiSpeakerHighBold } from "react-icons/pi";

/* ---------- Text-to-Speech Hook ---------- */
function useTextToSpeech() {
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef(null);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);

  const toggleTTS = () => {
    setIsTTSEnabled(prev => !prev);
    // Stop any current playback when disabling
    if (isTTSEnabled && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      setIsSpeaking(false);
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

  const speak = async (text) => {
    console.log('[TTS] speak called with:', {
      isTTSEnabled,
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

    try {
      console.log('[TTS] Fetching audio from API...');
      setIsSpeaking(true);
      
      const response = await fetch('/api/text-to-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText, voice: 'alloy', model: 'tts-1' })
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
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        console.log('[TTS] Audio playback ended');
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        setIsSpeaking(false);
      };

      audio.onerror = (e) => {
        console.error('[TTS] Audio playback error:', e);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
        setIsSpeaking(false);
      };

      console.log('[TTS] Starting audio playback...');
      await audio.play();
      console.log('[TTS] Audio playing');
    } catch (error) {
      console.error('[TTS] Error:', error);
      setIsSpeaking(false);
    }
  };

  return {
    isTTSEnabled,
    isSpeaking,
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
  const silenceTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const monitorIntervalRef = useRef(null);

  const SILENCE_THRESHOLD = 0.01; // Audio level threshold for silence
  const SILENCE_DURATION = 2000; // 2 seconds of silence to auto-stop

  const checkAudioLevel = () => {
    if (!analyserRef.current) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // Calculate average volume
    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
    const normalizedLevel = average / 255;

    // If audio level is below threshold, start silence timer
    if (normalizedLevel < SILENCE_THRESHOLD) {
      if (!silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => {
          stopRecording();
        }, SILENCE_DURATION);
      }
    } else {
      // Reset silence timer if sound detected
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

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
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Clean up
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
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
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
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
  const [user, setUser] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Text-to-Speech hook
  const { isTTSEnabled, isSpeaking, toggleTTS, speak } = useTextToSpeech();
  
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
      
      // Speak the response if TTS is enabled
      console.log('[TTS] Message complete, checking TTS:', { isTTSEnabled, textLength: textBuffer.length });
      if (isTTSEnabled && textBuffer.trim()) {
        console.log('[TTS] Calling speak function...');
        speak(textBuffer);
      } else {
        console.log('[TTS] Not speaking:', { isTTSEnabled, hasText: !!textBuffer.trim() });
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

  const handleMicrophoneClick = () => {
    if (isRecording) {
      // Stop recording manually
      stopRecording();
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
            title={isTTSEnabled ? 'Disable text-to-speech' : 'Enable text-to-speech'}
          >
            {isSpeaking ? (
              <PiSpeakerHighBold className={styles.speakerSpeaking} size={24} />
            ) : isTTSEnabled ? (
              <PiSpeakerHighBold className={styles.speakerEnabled} size={24} />
            ) : (
              <PiSpeakerSlash className={styles.speakerDisabled} size={24} />
            )}
          </button>
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
