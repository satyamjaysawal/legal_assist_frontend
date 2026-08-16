import { useEffect, useRef, useState } from "react";
import "./App.css";

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function getOrCreateId(storage, key) {
  let value = storage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    storage.setItem(key, value);
  }
  return value;
}

function parseSseBuffer(buffer, onEvent) {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() || "";
  for (const part of parts) {
    const line = part.split("\n").find((item) => item.startsWith("data: "));
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

function MemoryBoard({ layers, writes, facts }) {
  if (!layers?.length && !writes?.length) return null;

  return (
    <section className="memory">
      <div className="memory-head">
        <p className="eyebrow">Memory this turn</p>
        <p className="memory-sub">Which store was read / written</p>
      </div>
      <div className="memory-grid">
        {(layers || []).map((layer) => (
          <article key={layer.name} className={`mem-card ${layer.status || "miss"}`}>
            <header>
              <strong>{layer.label}</strong>
              <em>{(layer.status || "miss").toUpperCase()}</em>
            </header>
            <p className="mem-store">{layer.store}</p>
            <p>{layer.detail}</p>
            {layer.when && <time>{new Date(layer.when).toLocaleTimeString()}</time>}
          </article>
        ))}
      </div>
      {!!writes?.length && (
        <ul className="memory-writes">
          {writes.map((item) => (
            <li key={`w-${item.name}`} className={item.wrote ? "ok" : "skip"}>
              <span>Write · {item.label}</span>
              <span>{item.detail}</span>
              {item.when && <time>{new Date(item.when).toLocaleTimeString()}</time>}
            </li>
          ))}
        </ul>
      )}
      {!!facts?.length && (
        <div className="memory-facts">
          <p className="eyebrow">Recalled long-term facts</p>
          {facts.map((fact, i) => (
            <p key={`${fact.summary}-${i}`}>
              {fact.domain}: {fact.summary}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function readTheme() {
  const saved = localStorage.getItem("legal_assist_theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export default function App() {
  const [sessionId] = useState(() => getOrCreateId(sessionStorage, "legal_assist_session"));
  const [userId] = useState(() => getOrCreateId(localStorage, "legal_assist_user"));
  const [theme, setTheme] = useState(readTheme);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");
  const [model, setModel] = useState("");
  const [memory, setMemory] = useState({ layers: [], writes: [], facts: [] });
  const [stores, setStores] = useState(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("legal_assist_theme", theme);
  }, [theme]);

  useEffect(() => {
    fetch(`${API}/health`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.model) setModel(data.model);
        if (data?.memory) setStores(data.memory);
      })
      .catch(() => {});

    fetch(`${API}/session/${sessionId}?user_id=${encodeURIComponent(userId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.messages?.length) setMessages(data.messages);
        if (data?.memory) {
          setMemory({
            layers: data.memory.layers || [],
            writes: [],
            facts: data.memory.facts || [],
          });
        }
      })
      .catch(() => {});
  }, [sessionId, userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase, memory]);

  async function send(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || phase !== "idle") return;

    const history = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "", analysis: null, memoryLayers: [] }]);
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
        body: JSON.stringify({
          messages: history,
          session_id: sessionId,
          user_id: userId,
        }),
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
          if (event.type === "memory") {
            setMemory((prev) => ({
              ...prev,
              layers: event.layers || [],
              facts: event.facts || [],
            }));
            updateAssistant({ memoryLayers: event.layers || [] });
            setPhase("analysing");
          } else if (event.type === "memory_write") {
            setMemory((prev) => ({ ...prev, writes: event.writes || [] }));
          } else if (event.type === "analysis") {
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
          <h1>LangGraph + memory</h1>
        </div>
        <div className="top-actions">
          <span className="badge">{model || "connecting…"}</span>
          <button
            type="button"
            className="theme-btn"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      {stores && (
        <p className="store-line">
          In-memory {stores.in_memory?.ok ? "ready" : "off"} · Redis{" "}
          {stores.short_term?.ok ? "connected" : "down"} · MongoDB{" "}
          {stores.long_term?.ok ? stores.long_term.db : "down"}
        </p>
      )}

      <MemoryBoard layers={memory.layers} writes={memory.writes} facts={memory.facts} />

      <main className="thread">
        {messages.length === 0 && (
          <div className="empty">
            <p>
              Ask a legal question. Short-term chat lives in Redis; lasting facts
              go to MongoDB <code>legal_assist_inhouse</code>. Refresh keeps this
              session.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <article key={`${msg.role}-${i}`} className={`bubble ${msg.role}`}>
            <span className="who">{msg.role === "user" ? "You" : "Assistant"}</span>
            {msg.role === "assistant" && <AnalysisChips analysis={msg.analysis} />}
            {msg.role === "assistant" && !!msg.memoryLayers?.length && (
              <div className="chips mem-used">
                {msg.memoryLayers.map((layer) => (
                  <span key={layer.name}>
                    {layer.label}: {layer.status}
                  </span>
                ))}
              </div>
            )}
            <p>
              {msg.content ||
                (msg.role === "assistant" && phase === "analysing" ? "Loading memory…" : "")}
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
        <button className="send" type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
