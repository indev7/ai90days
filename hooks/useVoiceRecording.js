'use client';

import { useState, useRef } from 'react';

export default function useVoiceRecording(onTranscriptionComplete) {
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

  const SILENCE_RMS_THRESHOLD = 0.015;
  const SILENCE_DURATION_MS = 2000;
  const POST_SILENCE_GRACE_MS = 600;
  const POST_STOP_GRACE_MS = 300;
  const MAX_RECORDING_MS = 60000;

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

    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      const sample = (dataArray[i] - 128) / 128;
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / bufferLength);

    const now = Date.now();
    if (rms > SILENCE_RMS_THRESHOLD) {
      lastSoundTimeRef.current = now;
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
    } else if (now - lastSoundTimeRef.current >= SILENCE_DURATION_MS) {
      if (!silenceTimeoutRef.current) {
        silenceTimeoutRef.current = setTimeout(() => {
          stopRecording('silence');
        }, POST_SILENCE_GRACE_MS);
      }
    }

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

      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 2048;

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

        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
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
