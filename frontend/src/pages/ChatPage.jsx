import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { api, API_URL } from '../api/client';

export default function ChatPage() {
  const { token, user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const socketRef = useRef(null);
  const scrollRef = useRef(null);

  // Establish a single socket connection for the session
  useEffect(() => {
    const socket = io(API_URL, { auth: { token } });
    socketRef.current = socket;

    socket.on('connect_error', (err) => setError(`Chat connection error: ${err.message}`));
    socket.on('new_message', (message) => {
      setMessages((prev) => (message.interestId === activeIdRef.current ? [...prev, message] : prev));
    });

    return () => socket.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Keep a ref of activeId so the socket listener (set up once) reads the latest value
  const activeIdRef = useRef(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    api.chatThreads(token).then((d) => setThreads(d.threads));
  }, [token]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  async function openThread(thread) {
    setActiveId(thread.id);
    setError('');
    const history = await api.chatHistory(token, thread.id);
    setMessages(history.messages);
    socketRef.current.emit('join_room', { interestId: thread.id }, (ack) => {
      if (!ack.ok) setError(ack.error);
    });
  }

  function sendMessage(e) {
    e.preventDefault();
    if (!draft.trim() || !activeId) return;
    socketRef.current.emit('send_message', { interestId: activeId, content: draft }, (ack) => {
      if (!ack.ok) setError(ack.error);
    });
    setDraft('');
  }

  function threadLabel(t) {
    const counterparty = user.role === 'TENANT' ? t.listing.owner.name : t.tenant.name;
    return `${counterparty} — ${t.listing.location}`;
  }

  return (
    <div className="container">
      <h2>Chat</h2>
      {error && <div className="error-box">{error}</div>}
      <div className="chat-shell">
        <div className="chat-list">
          {threads.length === 0 && <div className="empty">No accepted matches yet. Chat unlocks once an interest is accepted.</div>}
          {threads.map((t) => (
            <div
              key={t.id}
              className={`chat-thread-item ${activeId === t.id ? 'active' : ''}`}
              onClick={() => openThread(t)}
            >
              <strong>{threadLabel(t)}</strong>
              <div className="muted">{t.messages[0]?.content || 'No messages yet'}</div>
            </div>
          ))}
        </div>
        <div className="chat-window">
          {!activeId ? (
            <div className="empty" style={{ margin: 'auto' }}>Select a conversation to start chatting</div>
          ) : (
            <>
              <div className="chat-messages" ref={scrollRef}>
                {messages.map((m) => (
                  <div key={m.id} className={`chat-bubble ${m.senderId === user.id ? 'mine' : 'theirs'}`}>
                    {m.content}
                  </div>
                ))}
              </div>
              <form className="chat-input-row" onSubmit={sendMessage}>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                />
                <button className="btn">Send</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
