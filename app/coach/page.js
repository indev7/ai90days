'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCoach } from '@/contexts/CoachContext';
import styles from './page.module.css';

// Action button component
function ActionButtons({ actions, onActionClick }) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className={styles.actionButtons}>
      {actions.map((action) => (
        <button
          key={action.id}
          className={styles.actionButton}
          onClick={() => onActionClick(action)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

// HTML form handler component
function HtmlFormHandler({ htmlContent, onFormSubmit }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const handleFormSubmit = async (e) => {
      e.preventDefault();
      console.log('Form submit intercepted');
      
      const form = e.target;
      let endpoint = form.dataset.endpoint;
      const method = form.dataset.method || 'POST';
      
      // Extract form data
      const formData = new FormData(form);
      const data = {};
      for (const [key, value] of formData.entries()) {
        data[key] = value;
      }
      
      // Fix endpoint for CREATE operations - LLM sometimes puts UUID in wrong place
      if (method === 'POST' && data.type && endpoint !== '/api/okrt') {
        console.log('🔧 Fixing CREATE endpoint from', endpoint, 'to /api/okrt');
        endpoint = '/api/okrt';
      }
      
      console.log('Form data:', { endpoint, method });
      console.log('Extracted data:', data);
      onFormSubmit(endpoint, method, data);
    };

    // Add event listeners to all forms in this container
    const forms = containerRef.current.querySelectorAll('form.coach-form');
    console.log('Found coach forms:', forms.length);
    
    forms.forEach(form => {
      form.addEventListener('submit', handleFormSubmit);
    });

    return () => {
      forms.forEach(form => {
        form.removeEventListener('submit', handleFormSubmit);
      });
    };
  }, [htmlContent, onFormSubmit]);

  return (
    <div 
      ref={containerRef}
      className={styles.actionForms}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  );
}

// Message component
function Message({ message, onActionClick, onRetry, onFormSubmit }) {
  const isUser = message.role === 'user';
  
  // Parse HTML forms from message content
  const htmlMatch = message.content?.match(/<ACTION_HTML>([\s\S]*?)<\/ACTION_HTML>/);
  const textContent = htmlMatch 
    ? message.content.replace(/<ACTION_HTML>[\s\S]*?<\/ACTION_HTML>/g, '').trim()
    : message.content;
  const htmlContent = htmlMatch ? htmlMatch[1] : null;
  
  return (
    <div className={`${styles.message} ${isUser ? styles.userMessage : styles.assistantMessage}`}>
      <div className={styles.messageContent}>
        {message.error ? (
          <div className={styles.errorMessage}>
            <p>{textContent}</p>
            <button className={styles.retryButton} onClick={onRetry}>
              Retry
            </button>
          </div>
        ) : (
          <>
            <p>{textContent}</p>
            {!isUser && htmlContent && (
              <HtmlFormHandler htmlContent={htmlContent} onFormSubmit={onFormSubmit} />
            )}
          </>
        )}
        {!isUser && message.actions && (
          <ActionButtons actions={message.actions} onActionClick={onActionClick} />
        )}
      </div>
    </div>
  );
}

export default function CoachPage() {
  const router = useRouter();
  const { messages, addMessage, updateMessage, isLoading, setLoading } = useCoach();
  const [input, setInput] = useState('');
  const [user, setUser] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          router.push('/login');
        }
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
      timestamp: new Date()
    };

    addMessage(userMessage);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].slice(-10) // Send last 10 messages
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      // Create initial message for streaming content
      const assistantMessageId = Date.now() + 1;
      const assistantMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date()
      };
      
      addMessage(assistantMessage);
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            try {
              const data = JSON.parse(line);
              
              if (data.type === 'content') {
                buffer += data.data;
                
                // Update the existing message content
                updateMessage(assistantMessageId, { content: buffer });
              } else if (data.type === 'done') {
                console.log('Streaming complete');
              }
            } catch (e) {
              console.error('Error parsing stream chunk:', e);
            }
          }
        }
      } catch (streamError) {
        console.error('Streaming error:', streamError);
        throw streamError;
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        error: true,
        timestamp: new Date()
      };
      addMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (endpoint, method, data) => {
    console.log('🚀 handleFormSubmit called with:', { endpoint, method, data });
    setLoading(true);
    
    try {
      // Validate that we have actual data, not placeholders
      // if (data.description === '[YOUR_TASK_DESCRIPTION]' || !data.description || data.description.startsWith('[')) {
      //   throw new Error('Please provide a real task description, not a placeholder');
      // }
      
      console.log('Form submission:', { endpoint, method, data });
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: method !== 'DELETE' ? JSON.stringify(data) : undefined
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.status} - ${errorText}`);
      }

      // Show success message
      const successMessage = {
        id: Date.now(),
        role: 'assistant',
        content: `✅ Task "${data.description}" added successfully!`,
        timestamp: new Date()
      };
      
      addMessage(successMessage);
      
    } catch (error) {
      console.error('Form submission error:', error);
      const errorMessage = {
        id: Date.now(),
        role: 'assistant',
        content: `❌ ${error.message}`,
        error: true,
        timestamp: new Date()
      };
      addMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleActionClick = async (action) => {
    setLoading(true);
    
    try {
      const apiBase = process.env.NEXT_PUBLIC_OKRT_API_BASE || '/api/okrt';
      
      // Debug log the action
      console.log('Action clicked:', action);
      
      // Map action endpoints to actual API structure
      let url, method, body;
      
      if (action.endpoint === '/delete' && action.body?.id) {
        // Delete endpoint: DELETE /api/okrt/[id]
        url = `${apiBase}/${action.body.id}`;
        method = 'DELETE';
        body = undefined;
      } else if (action.endpoint === '/update' && action.body?.id) {
        // Update endpoint: PUT /api/okrt/[id]
        url = `${apiBase}/${action.body.id}`;
        method = 'PUT';
        body = action.body;
      } else if (action.endpoint === '/create') {
        // Create endpoint: POST /api/okrt
        url = apiBase;
        method = 'POST';
        body = action.body;
      } else {
        // Fallback - assume create for new items without ID
        url = apiBase;
        method = 'POST';
        body = action.body;
      }
      
      console.log('API call:', { url, method, body });
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      // Show success message and refresh coach context
      const successMessage = {
        id: Date.now(),
        role: 'assistant',
        content: `✅ ${action.label} completed successfully!`,
        timestamp: new Date()
      };
      
      addMessage(successMessage);
      
    } catch (error) {
      console.error('Action error:', error);
      const errorMessage = {
        id: Date.now(),
        role: 'assistant',
        content: `❌ Failed to ${action.label.toLowerCase()}. Please try again.`,
        error: true,
        timestamp: new Date()
      };
      addMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (lastUserMessage) {
      sendMessage(lastUserMessage.content);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!user) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

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
            onRetry={handleRetry}
            onFormSubmit={handleFormSubmit}
          />
        ))}
        
        {isLoading && (
          <div className={styles.loadingMessage}>
            <div className={styles.typingIndicator}>
              <span></span>
              <span></span>
              <span></span>
            </div>
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
          <button
            type="submit"
            className={styles.sendButton}
            disabled={isLoading || !input.trim()}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
