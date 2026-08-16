import { useEffect, useRef, useState } from "react";
import "./App.css";

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [model, setModel] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/health`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.model) setModel(data.model);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || `Request failed (${res.status})`);
      }

      setMessages([...next, { role: "assistant", content: data.reply }]);
      if (data.model) setModel(data.model);
    } catch (err) {
      setError(err.message || "Could not reach the assistant");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="shell">
      <header className="top">
        <div>
          <p className="eyebrow">Legal AI Assistant</p>
          <h1>Chat with Groq</h1>
        </div>
        <span className="badge">{model || "connecting…"}</span>
      </header>

      <main className="thread">
        {messages.length === 0 && !loading && (
          <div className="empty">
            <p>Ask a legal question. Answers are informational, not formal advice.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <article key={`${msg.role}-${i}`} className={`bubble ${msg.role}`}>
            <span className="who">{msg.role === "user" ? "You" : "Assistant"}</span>
            <p>{msg.content}</p>
          </article>
        ))}

        {loading && <p className="status">Thinking…</p>}
        {error && <p className="error">{error}</p>}
        <div ref={bottomRef} />
      </main>

      <form className="composer" onSubmit={send}>
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          placeholder="Type a message…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(e);
            }
          }}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
