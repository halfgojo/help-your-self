import React, { useState, useCallback, useEffect } from 'react';
import ConversationSidebar from './components/ConversationSidebar';
import ChatInterface from './components/ChatInterface';
import { getConversation } from './api';
import './index.css';

export default function App() {
  const [context, setContext] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sidebarRefresh, setSidebarRefresh] = useState(0);

  // --- Theme Management ---
  const [theme, setTheme] = useState(() => {
    // Default to 'light' (pure white & black)
    return localStorage.getItem('curalink-theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('curalink-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  }, []);
  // -------------------------

  const handleContextSet = useCallback((newContext) => {
    setContext(newContext);
  }, []);

  const handleNewMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
    if (msg.role === 'assistant') {
      setSidebarRefresh((n) => n + 1);
    }
  }, []);

  const handleConversationIdSet = useCallback((id) => {
    setConversationId(id);
  }, []);

  const handleNewChat = useCallback(() => {
    setContext(null);
    setConversationId(null);
    setMessages([]);
  }, []);

  const handleSelectConversation = useCallback(async (conv) => {
    setConversationId(conv.conversationId);
    setContext({
      patientName: conv.patientName || '',
      disease: conv.disease || '',
      location: conv.location || '',
    });

    // Restore the message history from MongoDB
    try {
      const full = await getConversation(conv.conversationId);
      const restoredMessages = (full.messages || []).map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }));
      setMessages(restoredMessages);
    } catch {
      setMessages([]);
    }
  }, []);

  return (
    <>
      <div className="bg-gradient" />
      <div className="app-layout">
        <ConversationSidebar
          activeConversationId={conversationId}
          onSelect={handleSelectConversation}
          onNewChat={handleNewChat}
          refreshTrigger={sidebarRefresh}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <div className="main-content">
          <ChatInterface
            context={context}
            conversationId={conversationId}
            messages={messages}
            onContextSet={handleContextSet}
            onNewMessage={handleNewMessage}
            onConversationIdSet={handleConversationIdSet}
          />
        </div>
      </div>
    </>
  );
}
