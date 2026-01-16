'use client';

import { useCallback } from 'react';
import useVoiceRecording from '@/hooks/useVoiceRecording';

/** Bridge voice recording into input state updates and mic controls for the Aime page. */
// PSEUDOCODE: wire transcription callback and expose a mic toggle helper.
export default function useVoiceInput({ setInput, inputRef }) {
  const handleTranscription = useCallback((text) => {
    if (text && text.trim()) {
      setInput(text);
      if (inputRef?.current) {
        inputRef.current.focus();
      }
    }
  }, [setInput, inputRef]);

  const { isRecording, isProcessing, startRecording, stopRecording } =
    useVoiceRecording(handleTranscription);

  const handleMicrophoneClick = useCallback(() => {
    if (isRecording) {
      stopRecording('manual');
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    isProcessing,
    startRecording,
    stopRecording,
    handleMicrophoneClick
  };
}
