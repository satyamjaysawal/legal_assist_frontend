import { useEffect, useRef, useState } from "react";
import "./App.css";

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

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

function readTheme() {
  const saved = localStorage.getItem("legal_assist_theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function AnalysisChips({ analysis }) {
  if (!analysis) return null;
  const chips = [
    analysis.intent,
    analysis.domain,
    analysis.complexity,
    analysis.jurisdiction !== "unspecified" ? analysis.jurisdiction : null,
  ].filter(Boolean);
  return (
    <div className="chips">
      {chips.map((chip) => (
        <span key={chip}>{chip}</span>
      ))}
    </div>
  );
}

function TraceCard({ trace }) {
  if (!trace) return null;
  const steps = trace.steps || [];
  const layers = trace.memoryLayers || [];
  const cache = trace.cache;
  return (
    <details className="trace" open>
      <summary>Run details</summary>
      {trace.thinking && <p className="trace-think">{trace.thinking}</p>}
      {!!steps.length && (
        <ol className="trace-flow">
          {steps.map((step) => (
            <li key={step.name} className={step.status}>
              <strong>{step.name}</strong>
              <span>{step.status}</span>
              {step.detail && <em>{step.detail}</em>}
            </li>
          ))}
        </ol>
      )}
      {cache && (
        <p className={`trace-cache ${cache.status}`}>
          Prompt cache: <strong>{(cache.status || "miss").toUpperCase()}</strong>
          {cache.store ? ` · ${cache.store}` : ""} — {cache.detail}
        </p>
      )}
      {!!layers.length && (
        <div className="chips">
          {layers.map((layer) => (
            <span key={layer.name}>
              {layer.label}: {layer.status}
            </span>
          ))}
        </div>
      )}
    </details>
  );
}

function MemoryDetail({ token, journeyId, onBack, onOpenJourney }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const q = journeyId ? `?journey_id=${encodeURIComponent(journeyId)}` : "";
    fetch(`${API}/memory${q}`, { headers: authHeaders(token) })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Could not load memory"))))
      .then(setData)
      .catch((err) => setError(err.message));
  }, [token, journeyId]);

  if (error) {
    return (
      <section className="panel">
        <p className="error">{error}</p>
        <button type="button" className="ghost" onClick={onBack}>
          Back
        </button>
      </section>
    );
  }
  if (!data) return <p className="status">Loading memory…</p>;

  const stores = [
    { key: "in_memory", label: "In-memory", hint: "Process RAM" },
    { key: "short_term", label: "Short-term", hint: "Redis" },
    { key: "long_term", label: "Long-term", hint: "MongoDB" },
    { key: "prompt_cache", label: "Prompt cache", hint: "Redis + RAM" },
  ];

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Memory</h2>
        <button type="button" className="ghost" onClick={onBack}>
          Back
        </button>
      </div>
      <p className="memory-gap">
        Journey {data.journey_id ? data.journey_id.slice(0, 8) : "—"}
      </p>

      <div className="memory-grid four">
        {stores.map((store) => {
          const item = data.stores?.[store.key] || {};
          return (
            <article key={store.key} className={`mem-card ${item.ok ? "hit" : "error"}`}>
              <header>
                <strong>{store.label}</strong>
                <em>{item.ok ? "ON" : "OFF"}</em>
              </header>
              <p className="mem-store">{store.hint}</p>
              <p>{item.host || item.db || item.store || "—"}</p>
              {item.error && <p className="error">{item.error}</p>}
            </article>
          );
        })}
      </div>

      {!!data.layers?.length && (
        <>
          <p className="eyebrow memory-gap">This journey</p>
          <div className="memory-grid four">
            {data.layers.map((layer) => (
              <article key={layer.name} className={`mem-card ${layer.status || "miss"}`}>
                <header>
                  <strong>{layer.label}</strong>
                  <em>{(layer.status || "miss").toUpperCase()}</em>
                </header>
                <p className="mem-store">{layer.store}</p>
                <p>{layer.detail}</p>
                {layer.when && <time>{new Date(layer.when).toLocaleString()}</time>}
              </article>
            ))}
          </div>
        </>
      )}

      {!!data.thread?.length && (
        <div className="memory-facts">
          <p className="eyebrow memory-gap">Thread snapshot ({data.thread.length})</p>
          {data.thread.map((msg, i) => (
            <p key={`${msg.role}-${i}`}>
              <strong>{msg.role}:</strong> {msg.content.slice(0, 180)}
              {msg.content.length > 180 ? "…" : ""}
            </p>
          ))}
        </div>
      )}

      <div className="memory-facts">
        <p className="eyebrow memory-gap">Long-term facts ({data.facts?.length || 0})</p>
        {!data.facts?.length && <p>No saved facts yet.</p>}
        {data.facts?.map((fact, i) => (
          <article key={`${fact.created_at}-${i}`} className="fact-row">
            <header>
              <strong>{fact.domain || "general"}</strong>
              {fact.created_at && <time>{new Date(fact.created_at).toLocaleString()}</time>}
            </header>
            <p>{fact.summary}</p>
            {fact.query && fact.query !== fact.summary && <p className="mem-store">Q: {fact.query}</p>}
            {fact.journey_id && (
              <button
                type="button"
                className="ghost"
                onClick={() => onOpenJourney(fact.journey_id)}
              >
                Open journey {fact.journey_id.slice(0, 8)}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const res = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Auth failed");
      localStorage.setItem("legal_assist_token", data.token);
      onAuthed(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark">L</span>
          Legal Assist
        </div>
        <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        {mode === "register" && (
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="auth-primary" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Continue" : "Create account"}
        </button>
        <button
          type="button"
          className="auth-switch"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Need an account?" : "Have an account?"}
        </button>
      </form>
    </div>
  );
}

function Profile({ user, journeys, token, onBack, onUser }) {
  const [name, setName] = useState(user?.name || "");
  const [note, setNote] = useState("");

  async function save(event) {
    event.preventDefault();
    const res = await fetch(`${API}/auth/me`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setNote(data.detail || "Could not update");
      return;
    }
    onUser(data.user);
    setNote("Profile saved");
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>{user?.name || "Profile"}</h2>
        <button type="button" className="ghost" onClick={onBack}>
          Back
        </button>
      </div>
      <dl className="profile-grid">
        <div>
          <dt>Email</dt>
          <dd>{user?.email}</dd>
        </div>
        <div>
          <dt>User ID</dt>
          <dd>{user?.user_id}</dd>
        </div>
        <div>
          <dt>Threads</dt>
          <dd>{journeys.length}</dd>
        </div>
        <div>
          <dt>Joined</dt>
          <dd>{user?.created_at ? new Date(user.created_at).toLocaleString() : "—"}</dd>
        </div>
      </dl>
      <form className="profile-form" onSubmit={save}>
        <label>
          Display name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className="auth-primary" type="submit">
          Save profile
        </button>
        {note && <p className="status">{note}</p>}
      </form>
    </section>
  );
}

export default function App() {
  const [theme, setTheme] = useState(readTheme);
  const [token, setToken] = useState(() => localStorage.getItem("legal_assist_token") || "");
  const [user, setUser] = useState(null);
  const [journeys, setJourneys] = useState([]);
  const [journeyId, setJourneyId] = useState("");
  const [view, setView] = useState("chat");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");
  const [model, setModel] = useState("");
  const [memory, setMemory] = useState({ layers: [], writes: [], facts: [] });
  const [stores, setStores] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [followups, setFollowups] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [editTitle, setEditTitle] = useState("");
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
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/auth/me`, { headers: authHeaders(token) })
      .then((res) => {
        if (res.status === 401) {
          logout();
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data) => {
        if (!data) return;
        setUser(data.user);
        setJourneys(data.journeys || []);
        if (!journeyId && data.journeys?.[0]?.journey_id) {
          setJourneyId(data.journeys[0].journey_id);
        }
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token || !journeyId) return;
    fetch(`${API}/journeys/${journeyId}`, { headers: authHeaders(token) })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setMessages(data.messages || []);
        if (data.memory) {
          setMemory({
            layers: data.memory.layers || [],
            writes: [],
            facts: data.memory.facts || [],
          });
        }
      })
      .catch(() => {});
  }, [token, journeyId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase, memory]);

  function logout() {
    localStorage.removeItem("legal_assist_token");
    setToken("");
    setUser(null);
    setJourneys([]);
    setJourneyId("");
    setMessages([]);
    setView("chat");
  }

  function onAuthed(data) {
    setToken(data.token);
    setUser(data.user);
    const list = data.journeys?.length ? data.journeys : data.journey ? [data.journey] : [];
    setJourneys(list);
    setJourneyId(data.journey?.journey_id || list[0]?.journey_id || "");
    setView("chat");
  }

  async function newJourney() {
    const res = await fetch(`${API}/journeys`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ title: "New thread" }),
    });
    const data = await res.json();
    if (!res.ok) return;
    setJourneys((prev) => [data, ...prev]);
    setJourneyId(data.journey_id);
    setMessages([]);
    setMemory({ layers: [], writes: [], facts: [] });
    setFollowups([]);
    setView("chat");
    setSidebarOpen(false);
  }

  async function renameCurrent(id, title) {
    const clean = title.trim();
    if (!clean) return;
    const res = await fetch(`${API}/journeys/${id}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({ title: clean }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;
    setJourneys((prev) => prev.map((item) => (item.journey_id === id ? { ...item, ...data } : item)));
    setEditingId("");
  }

  async function send(event, preset) {
    if (event?.preventDefault) event.preventDefault();
    const text = (preset ?? input).trim();
    if (!text || phase !== "idle" || !journeyId) return;

    const history = [...messages, { role: "user", content: text }];
    setMessages([
      ...history,
      { role: "assistant", content: "", analysis: null, memoryLayers: [], trace: { thinking: "Starting…", steps: [], cache: null } },
    ]);
    setInput("");
    setPhase("analysing");
    setError("");
    setFollowups([]);

    const updateAssistant = (patch) => {
      setMessages((current) => {
        const next = [...current];
        const last = next[next.length - 1];
        if (!last || last.role !== "assistant") return current;
        const applied = typeof patch === "function" ? patch(last) : patch;
        next[next.length - 1] = { ...last, ...applied };
        return next;
      });
    };

    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          messages: history,
          journey_id: journeyId,
          session_id: journeyId,
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
        buffer = parseSseBuffer(buffer + decoder.decode(value, { stream: true }), (evt) => {
          if (evt.type === "thinking") {
            updateAssistant((prev) => ({
              trace: { ...(prev.trace || {}), thinking: evt.text },
            }));
            setPhase("analysing");
          } else if (evt.type === "flow") {
            updateAssistant((prev) => ({
              trace: { ...(prev.trace || {}), steps: evt.steps || [] },
            }));
          } else if (evt.type === "cache") {
            updateAssistant((prev) => ({
              trace: { ...(prev.trace || {}), cache: evt.report },
            }));
          } else if (evt.type === "cache_write") {
            updateAssistant((prev) => ({
              trace: {
                ...(prev.trace || {}),
                cacheWrite: evt.report,
                cache: prev.trace?.cache || evt.report,
              },
            }));
          } else if (evt.type === "memory") {
            setMemory((prev) => ({ ...prev, layers: evt.layers || [], facts: evt.facts || [] }));
            updateAssistant((prev) => ({
              memoryLayers: evt.layers || [],
              trace: { ...(prev.trace || {}), memoryLayers: evt.layers || [] },
            }));
            if (evt.journey_id) setJourneyId(evt.journey_id);
          } else if (evt.type === "memory_write") {
            setMemory((prev) => ({ ...prev, writes: evt.writes || [] }));
            if (evt.title) {
              setJourneys((prev) =>
                prev.map((item) =>
                  item.journey_id === (evt.journey_id || journeyId)
                    ? { ...item, title: evt.title }
                    : item
                )
              );
            }
          } else if (evt.type === "followups") {
            setFollowups(evt.questions || []);
          } else if (evt.type === "analysis") {
            updateAssistant({ analysis: evt.analysis });
            setPhase("writing");
            if (evt.model) setModel(evt.model);
          } else if (evt.type === "token") {
            assembled += evt.content || "";
            updateAssistant({ content: assembled });
            setPhase("writing");
          } else if (evt.type === "done" && evt.model) {
            setModel(evt.model);
          } else if (evt.type === "error") {
            throw new Error(evt.detail || "Stream failed");
          }
        });
      }
      if (!assembled.trim()) throw new Error("Empty reply from assistant");
      fetch(`${API}/journeys`, { headers: authHeaders(token) })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data?.journeys && setJourneys(data.journeys))
        .catch(() => {});
    } catch (err) {
      setError(err.message || "Could not reach the assistant");
    } finally {
      setPhase("idle");
      inputRef.current?.focus();
    }
  }

  if (!token) {
    return (
      <div className="auth-screen">
        <button
          type="button"
          className="ghost auth-theme"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
        <AuthScreen onAuthed={onAuthed} />
      </div>
    );
  }

  const busy = phase !== "idle";
  const initial = (user?.name || user?.email || "U").slice(0, 1).toUpperCase();

  return (
    <div className="app-frame">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">L</span>
          Legal Assist
        </div>
        <button type="button" className="new-chat" onClick={newJourney}>
          + New chat
        </button>
        <button
          type="button"
          className={`nav-btn ${view === "memory" ? "active" : ""}`}
          onClick={() => {
            setView("memory");
            setSidebarOpen(false);
          }}
        >
          Memory
        </button>
        <p className="journey-label">Chats</p>
        <ul className="journey-list">
          {journeys.map((item) => (
            <li key={item.journey_id} className={item.journey_id === journeyId ? "active" : ""}>
              {editingId === item.journey_id ? (
                <form
                  className="rename-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    renameCurrent(item.journey_id, editTitle);
                  }}
                >
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    autoFocus
                    onBlur={() => renameCurrent(item.journey_id, editTitle)}
                  />
                </form>
              ) : (
                <div className="chat-row">
                  <button
                    type="button"
                    className="chat-open"
                    onClick={() => {
                      setJourneyId(item.journey_id);
                      setFollowups([]);
                      setView("chat");
                      setSidebarOpen(false);
                    }}
                  >
                    <strong>{item.title}</strong>
                  </button>
                  <button
                    type="button"
                    className="rename-btn"
                    aria-label="Rename chat"
                    onClick={() => {
                      setEditingId(item.journey_id);
                      setEditTitle(item.title || "");
                    }}
                  >
                    ✎
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="sidebar-foot">
          <button type="button" className="user-chip" onClick={() => setView("profile")}>
            <span className="avatar">{initial}</span>
            <span>
              <strong>{user?.name || "Account"}</strong>
              <small>{user?.email}</small>
            </span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="ghost mobile-only" onClick={() => setSidebarOpen((v) => !v)}>
            Menu
          </button>
          <h1>{journeys.find((item) => item.journey_id === journeyId)?.title || "Legal Assist"}</h1>
          <div className="top-actions">
            <button type="button" className="ghost" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button type="button" className="ghost" onClick={logout}>
              Log out
            </button>
          </div>
        </header>

        {view === "profile" ? (
          <Profile
            user={user}
            journeys={journeys}
            token={token}
            onBack={() => setView("chat")}
            onUser={setUser}
          />
        ) : view === "memory" ? (
          <MemoryDetail
            token={token}
            journeyId={journeyId}
            onBack={() => setView("chat")}
            onOpenJourney={(id) => {
              setJourneyId(id);
              setView("chat");
            }}
          />
        ) : (
          <>
            <main className="thread">
              <div className="thread-inner">
                {messages.length === 0 && (
                  <div className="empty">
                    <h2>What can I help with?</h2>
                    <p>Ask a legal question. Memory stays on this journey.</p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={`${msg.role}-${i}`} className={`row ${msg.role}`}>
                    {msg.role === "assistant" && <span className="avatar bot">L</span>}
                    <div className="msg">
                      {msg.role === "assistant" && <TraceCard trace={msg.trace} />}
                      {msg.role === "assistant" && <AnalysisChips analysis={msg.analysis} />}
                      <p>
                        {msg.content ||
                          (phase === "analysing" ? msg.trace?.thinking || "Thinking…" : "")}
                      </p>
                    </div>
                  </div>
                ))}
                {phase === "writing" && <p className="status">Streaming…</p>}
                {error && <p className="error">{error}</p>}
                {!!followups.length && phase === "idle" && (
                  <div className="followups">
                    <p>Follow up</p>
                    {followups.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => send(null, q)}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            </main>
            <div className="composer-wrap">
              <form className="composer" onSubmit={send}>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  placeholder="Ask anything"
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(e);
                    }
                  }}
                />
                <button className="send" type="submit" disabled={busy || !input.trim()} aria-label="Send">
                  ↑
                </button>
              </form>
              <p className="hint">
                {model || "Legal Assist"} · informational only, not formal advice
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
