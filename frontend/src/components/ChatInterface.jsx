import React, { useState, useRef, useEffect, useCallback } from 'react';
import { submitQueryStream } from '../api';
import MessageBubble from './MessageBubble';
import PatientContextForm from './PatientContextForm';

const DEFAULT_EXAMPLE_QUERIES = [
  { label: 'Lung Cancer', text: 'Latest treatment for lung cancer', disease: 'lung cancer' },
  { label: 'Diabetes', text: 'Clinical trials for type 2 diabetes', disease: 'type 2 diabetes' },
  { label: 'Alzheimer\'s', text: 'Top researchers in Alzheimer\'s disease', disease: 'Alzheimer\'s disease' },
  { label: 'Heart Disease', text: 'Recent studies on heart disease', disease: 'heart disease' },
];

function getDynamicExamples(disease) {
  if (!disease) return DEFAULT_EXAMPLE_QUERIES;
  const d = disease.toLowerCase();
  return [
    { label: 'Treatment', text: `Latest treatment for ${d}`, disease: d },
    { label: 'Trials', text: `Clinical trials for ${d}`, disease: d },
    { label: 'Side Effects', text: `Managing symptoms of ${d}`, disease: d },
    { label: 'Research', text: `Recent studies on ${d}`, disease: d },
  ];
}

// Rotate through different status messages while waiting for the LLM
const THINKING_PHASES = [
  'Expanding your query with AI...',
  'Searching PubMed database…',
  'Searching OpenAlex research papers…',
  'Fetching ClinicalTrials.gov…',
  'Ranking results by relevance…',
  'Generating personalized insights…',
];

export default function ChatInterface({
  context,
  conversationId,
  messages,
  onContextSet,
  onNewMessage,
  onConversationIdSet,
}) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [thinkingPhase, setThinkingPhase] = useState(0);
  const [error, setError] = useState('');
  const [showContextForm, setShowContextForm] = useState(!context);
  const [streamingMessage, setStreamingMessage] = useState(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const phaseTimerRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, streamingMessage, scrollToBottom]);

  useEffect(() => {
    if (context) setShowContextForm(false);
  }, [context]);

  // Cycle through thinking phases during loading
  useEffect(() => {
    if (loading) {
      setThinkingPhase(0);
      phaseTimerRef.current = setInterval(() => {
        setThinkingPhase((prev) => (prev + 1) % THINKING_PHASES.length);
      }, 2500);
    } else {
      clearInterval(phaseTimerRef.current);
    }
    return () => clearInterval(phaseTimerRef.current);
  }, [loading]);

  const handleContextSubmit = (formData) => {
    onContextSet(formData);
    setShowContextForm(false);
    if (formData.query) {
      sendMessage(formData.query, formData);
    }
  };

  const sendMessage = async (text, contextOverride) => {
    const activeContext = contextOverride || context;
    if (!activeContext?.disease) {
      setShowContextForm(true);
      return;
    }

    const trimmed = text.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    setInput('');
    setStreamingMessage(null);

    // Show user message immediately — good UX
    onNewMessage({ role: 'user', content: trimmed, timestamp: new Date().toISOString() });

    try {
      let currentData = null;
      let streamedText = '';

      // Called once when publications/trials are ready (early in the pipeline)
      const onData = (data) => {
        if (data.conversationId && data.conversationId !== conversationId) {
          onConversationIdSet(data.conversationId);
        }
        currentData = data;
        setLoading(false); // Stop the thinking spinner — tab data is here
        setStreamingMessage({
          role: 'assistant',
          content: streamedText,
          timestamp: new Date().toISOString(),
          data: currentData,
        });
      };

      // Called for each text chunk from the LLM
      const onChunk = (textChunk) => {
        streamedText += textChunk;
        setStreamingMessage((prev) => ({
          ...prev,
          role: 'assistant',
          content: streamedText,
          timestamp: new Date().toISOString(),
          data: currentData,
        }));
      };

      await submitQueryStream(
        {
          patientName: activeContext.patientName || '',
          disease: activeContext.disease,
          query: trimmed,
          location: activeContext.location || '',
          indianFocus: activeContext.indianFocus || false,
          conversationId,
        },
        onChunk,
        onData
      );

      // Commit the completed message to the permanent list
      onNewMessage({
        role: 'assistant',
        content: streamedText || 'Research complete.',
        timestamp: new Date().toISOString(),
        data: currentData,
      });

    } catch (err) {
      setError(`Error: ${err.message || 'Request failed. Is the backend running?'}`);
      onNewMessage({
        role: 'assistant',
        content: `Sorry, I encountered an error: ${err.message}. Please check the backend is running and try again.`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
      setStreamingMessage(null);
    }
  };

  const handleSend = () => {
    if (!input.trim() || loading) return;
    
    // Friction-less interaction: If user types without context, 
    // open the modal and pre-fill their typing as the target query.
    if (!context) {
      onContextSet({ disease: '', patientName: '', location: '', query: input.trim() });
      setShowContextForm(true);
      return;
    }
    
    sendMessage(input.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExampleClick = (ex) => {
    if (!context) {
      // Auto-fill disease from example and open form
      onContextSet({ disease: ex.disease, patientName: '', location: '', query: ex.text });
      setShowContextForm(true);
      return;
    }
    setInput(ex.text);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const showWelcome = messages.length === 0 && !loading && !streamingMessage;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      {/* Header */}
      <div className="app-header">
        <div className="header-context">
          {context?.disease ? (
            <>
              <div className="context-pill">
                <span className="label">Condition:</span>
                <span className="value">{context.disease}</span>
              </div>
              {context?.patientName && (
                <div className="context-pill">
                  <span className="label">Patient:</span>
                  <span className="value">{context.patientName}</span>
                </div>
              )}
              {context?.location && (
                <div className="context-pill">
                  <span className="label">Location:</span>
                  <span className="value">{context.location}</span>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: '500' }}>
              {/* Removed redundant left-aligned welcome text to maintain center-aligned hero balance */}
            </div>
          )}
        </div>
        <div className="header-actions">
          <button
            id="btn-edit-context"
            className="btn-secondary"
            title="Edit patient context"
            onClick={() => setShowContextForm(true)}
            style={{ padding: '6px 14px', fontSize: '0.85rem' }}
          >
            + Set Research Context
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="chat-area">
        {showWelcome && (
          <div className="welcome-screen">
            <h1 className="welcome-title">HelpYourself</h1>
            <p className="welcome-subtitle">
              AI-powered Medical Research Companion.<br />
              Retrieves and reasons over real publications from PubMed,
              OpenAlex, and ClinicalTrials.gov to deliver personalized, evidence-based insights.
            </p>
            <div className="welcome-examples">
              {getDynamicExamples(context?.disease).map((ex, i) => (
                <div
                  key={i}
                  id={`example-query-${i}`}
                  className="example-card"
                  onClick={() => handleExampleClick(ex)}
                >
                  <div className="example-card-text">{ex.text}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} isStreaming={false} />
        ))}

        {streamingMessage && (
          <MessageBubble message={streamingMessage} isStreaming={true} />
        )}

        {/* Show animated thinking indicator only while waiting for initial data */}
        {loading && !streamingMessage && (
          <div className="thinking-indicator">
            <div className="thinking-dots">
              <div className="thinking-dot" />
              <div className="thinking-dot" />
              <div className="thinking-dot" />
            </div>
            <div className="thinking-text">
              <span className="thinking-phase">{THINKING_PHASES[thinkingPhase]}</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="input-area">
        {error && (
          <div className="error-message" style={{ marginBottom: '10px' }}>
            ⚠️ {error}
          </div>
        )}

        <div className="input-row">
          <div className="input-field-wrapper">
            <textarea
              ref={inputRef}
              id="chat-input"
              className="chat-input"
              placeholder={
                context
                  ? `Ask a follow-up about ${context.disease}...`
                  : 'Start typing your medical research query...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              rows={1}
            />
          </div>
          <button
            id="btn-send"
            className="send-btn"
            onClick={handleSend}
            disabled={!input.trim() || loading}
            title="Send message (Enter)"
          >
            {loading ? 'Wait...' : 'Send'}
          </button>
        </div>

        {/* Persistent medical disclaimer */}
        <div className="disclaimer-bar">
          <span>
            Information is sourced from <strong>PubMed</strong>, <strong>OpenAlex</strong> &amp; <strong>ClinicalTrials.gov</strong> and AI-assisted.
            It is <strong>not a substitute</strong> for professional medical advice. Always consult a licensed healthcare provider.
          </span>
        </div>
      </div>

      {/* Patient Context Form Modal */}
      {showContextForm && (
        <PatientContextForm
          onSubmit={handleContextSubmit}
          onClose={() => setShowContextForm(false)}
          initialData={context}
        />
      )}
    </div>
  );
}
