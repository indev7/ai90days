# Summary: app/coach/page.js

This document summarizes the functions, hooks, and components defined in `app/coach/page.js`.

## Functions and Hooks

### useTextToSpeech(preferredVoice)
Custom hook that manages text-to-speech playback, including enable/disable state, audio priming to satisfy user-gesture requirements, queueing text/audio, and fetching synthesized speech from `/api/text-to-speech`.

### labelForAction(action)
Derives a human-readable label for an OKRT action based on its intent, type, and payload.

### normalizeActions(rawActions)
Normalizes raw action objects into a consistent shape for UI rendering, resolving endpoint paths and assigning stable keys.

### ActionButtons({ actions, onActionClick, onRunAll })
Component that renders Accept/Accept All buttons for suggested OKRT actions and fetches descriptions for update/delete actions.

### HtmlFormHandler({ htmlContent, onFormSubmit })
Component that injects AI-provided HTML forms and wires submit handlers to call the app’s OKRT APIs.

### Message({ message, onActionClick, onRunAll, onRetry, onFormSubmit, onQuickReply })
Component that renders a chat message (user/assistant), markdown content, error states, action spinners, action buttons, and legacy HTML form output.

### fetchOKRTById(id)
Helper that fetches a single OKRT by ID from `/api/okrt/[id]` and returns the OKRT object or null on error.

### CoachPage()
Main page component that:
- Loads user and OKRT context, redirects to login if unauthenticated.
- Manages chat state, input, streaming responses, and text-to-speech playback.
- Builds OKRT context for `/api/llm` and streams assistant replies.
- Handles action execution (single, all, and form-based) and updates the OKRT cache.
- Renders the chat UI, voice input controls, and message composer.

## Notes
- Uses `useCoach`, `useMainTree`, and `useMainTreeStore` for message and OKRT state.
- Supports voice input via `useVoiceRecording` and text-to-speech output via `useTextToSpeech`.
