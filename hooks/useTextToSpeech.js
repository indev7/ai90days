'use client';

import { useState, useRef } from 'react';

/** Manage browser TTS playback, queuing, and enablement state for assistant messages. */
// PSEUDOCODE: hold TTS state/queues and expose toggle + speak helpers.
export default function useTextToSpeech(preferredVoice) {
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const audioRef = useRef(null);
  const audioQueueRef = useRef([]);
  const textQueueRef = useRef([]);
  const isPlayingRef = useRef(false);
  const isFetchingRef = useRef(false);

  /** Toggle TTS on/off and clear queued audio when disabling playback. */
  // PSEUDOCODE: flip enabled, prime audio on enable, otherwise stop and clear queues.
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

  /** Lazily create and reuse a single Audio element for queued playback. */
  // PSEUDOCODE: create Audio once, configure it, then return it.
  const ensureAudioElement = () => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'auto';
      audio.playsInline = true;
      audioRef.current = audio;
    }
    return audioRef.current;
  };

  /** Attempt to unlock audio playback by playing a silent clip after a user gesture. */
  // PSEUDOCODE: play silent clip, reset, and track whether gesture is still needed.
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

  /** Strip markdown, code blocks, and tool output so TTS speaks human-readable text. */
  // PSEUDOCODE: remove code/links/tags/formatting and collapse whitespace.
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

  /** Play the next audio blob in the queue and advance until the queue is empty. */
  // PSEUDOCODE: dequeue audio, play it, then recurse on end/error.
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

  /** Enqueue text for TTS generation, fetch audio, and schedule playback. */
  // PSEUDOCODE: guard state, clean text, enqueue for fetch, then play when ready.
  const speak = async (text) => {
    if (!isTTSEnabled) {
      return;
    }
    
    if (!text || text.trim().length === 0) {
      return;
    }

    const cleanText = extractTextContent(text);
    
    if (!cleanText || cleanText.length === 0) {
      return;
    }

    const voiceToUse = preferredVoice || 'alloy';

    /** Dequeue pending text items, call the TTS API, and enqueue audio blobs. */
    // PSEUDOCODE: take next text, POST to API, create blob URL, push to audio queue.
    const processTextQueue = async () => {
      if (isFetchingRef.current) return;
      const nextItem = textQueueRef.current.shift();
      if (!nextItem) return;
      isFetchingRef.current = true;

      try {
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
  
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        audioQueueRef.current.push({ url: audioUrl });
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

    /** Add cleaned text to the queue and kick off TTS generation. */
    // PSEUDOCODE: push item into text queue and start processing.
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
