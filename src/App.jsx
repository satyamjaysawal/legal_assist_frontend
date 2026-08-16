import { useEffect, useRef, useState } from "react";
import "./App.css";

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function parseSseBuffer(buffer, onEvent) {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() || "";
  for (const part of parts) {
    const line = part
      .split("\n")
      .find((item) => item.startsWith("data: "));
    if (!line) continue;
    try {
      onEvent(JSON.parse(line.slice(6)));
    } catch {
      // ignore a partial/invalid chunk
    }
  }
  return rest;
}

function AnalysisChips({ analysis }) {
  if (!analysis) return null;
  const chips = [
    analysis.intent,
    analysis.domain,
    analysis.complexity,
    analysis.jurisdiction !== "unspecified" ? analysis.jurisdiction : null,
    analysis.on_topic === false ? "off-topic" : null,
  ].filter(Boolean);

  return (
    <div className="chips">
      {chips.map((chip) => (
        <span key={chip}>{chip}</span>
      ))}
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState("idle");
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
  }, [messages, phase]);

  async function send(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || phase !== "idle") return;

    const history = [...messages, { role: "user", content: text }];
    setMessages([
      ...history,
      { role: "assistant", content: "", analysis: null },
    ]);
    setInput("");
    setPhase("analysing");
    setError("");

    const updateAssistant = (patch) => {
      setMessages((current) => {
        const next = [...current];
        const last = next[next.length - 1];
        if (!last || last.role !== "assistant") return current;
        next[next.length - 1] = { ...last, ...patch };
        return next;
      });
    };

    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer = parseSseBuffer(buffer + decoder.decode(value, { stream: true }), (event) => {
          if (event.type === "analysis") {
            updateAssistant({ analysis: event.analysis });
            setPhase("writing");
            if (event.model) setModel(event.model);
          } else if (event.type === "token") {
            assembled += event.content || "";
            updateAssistant({ content: assembled });
            setPhase("writing");
          } else if (event.type === "done") {
            if (event.model) setModel(event.model);
          } else if (event.type === "error") {
            throw new Error(event.detail || "Stream failed");
          }
        });
      }

      if (!assembled.trim()) {
        throw new Error("Empty reply from assistant");
      }
    } catch (err) {
      setError(err.message || "Could not reach the assistant");
    } finally {
      setPhase("idle");
      inputRef.current?.focus();
    }
  }

  const busy = phase !== "idle";

  return (
    <div className="shell">
      <header className="top">
        <div>
          <p className="eyebrow">Legal AI Assistant</p>
          <h1>LangGraph + Groq</h1>
        </div>
        <span className="badge">{model || "connecting…"}</span>
      </header>

      <main className="thread">
        {messages.length === 0 && (
          <div className="empty">
            <p>
              Ask a legal question. A LangGraph analyser classifies it first,
              then the answer streams in. Informational only — not formal advice.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <article key={`${msg.role}-${i}`} className={`bubble ${msg.role}`}>
            <span className="who">{msg.role === "user" ? "You" : "Assistant"}</span>
            {msg.role === "assistant" && <AnalysisChips analysis={msg.analysis} />}
            <p>
              {msg.content ||
                (msg.role === "assistant" && phase === "analysing" ? "Analysing query…" : "")}
            </p>
          </article>
        ))}

        {phase === "writing" && <p className="status">Streaming…</p>}
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
        <button type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
