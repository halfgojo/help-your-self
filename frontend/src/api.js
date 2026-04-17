import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 180000, // 3 min for LLM responses
  headers: { 'Content-Type': 'application/json' },
});

export async function submitQuery({ patientName, disease, query, location, indianFocus, conversationId }) {
  const response = await api.post('/query', {
    patientName,
    disease,
    query,
    location,
    indianFocus,
    conversationId,
  });
  return response.data;
}

export async function submitQueryStream({ patientName, disease, query, location, indianFocus, conversationId }, onChunk, onData) {
  const url = `${API_BASE}/query-stream`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientName, disease, query, location, indianFocus, conversationId })
  });

  if (!response.ok) {
    throw new Error('Streaming failed');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let done = false;
  let buffer = '';

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop(); // keep incomplete chunk

      for (const part of parts) {
        if (!part.startsWith('event: ')) continue;
        
        const eventLineMatch = part.match(/event: (.+)/);
        const dataLineMatch = part.match(/data: (.+)/);
        
        if (eventLineMatch && dataLineMatch) {
          const event = eventLineMatch[1].trim();
          try {
            const parsedData = JSON.parse(dataLineMatch[1].trim());
            if (event === 'data') {
              onData(parsedData);
            } else if (event === 'chunk') {
              onChunk(parsedData.text);
            } else if (event === 'error') {
              throw new Error(parsedData.message);
            }
          } catch (e) { }
        }
      }
    }
  }
}

export async function translateText(text, targetLang) {
  const response = await api.post('/translate', { text, targetLang });
  return response.data.text;
}

export async function listConversations() {
  const response = await api.get('/conversations');
  return response.data.conversations;
}

export async function getConversation(id) {
  const response = await api.get(`/conversations/${id}`);
  return response.data.conversation;
}

export async function deleteConversation(id) {
  const response = await api.delete(`/conversations/${id}`);
  return response.data;
}

export default api;
