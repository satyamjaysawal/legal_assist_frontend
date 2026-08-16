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

function MemoryBoard({ layers, writes, facts }) {
  if (!layers?.length && !writes?.length) return null;
  return (
    <section className="memory">
      <div className="memory-head">
        <p className="eyebrow">Memory this turn</p>
        <p className="memory-sub">User thread + journey stores</p>
      </div>
      <div className="memory-grid four">
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
            </li>
          ))}
        </ul>
      )}
      {!!facts?.length && (
        <div className="memory-facts">
          <p className="eyebrow">Long-term facts</p>
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
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={submit}>
        <p className="eyebrow">Legal AI Assistant</p>
        <h1>{mode === "login" ? "Sign in" : "Create account"}</h1>
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
        <button className="send" type="submit" disabled={busy}>
          {busy ? "Please wait…" : mode === "login" ? "Login" : "Register"}
        </button>
        <button
          type="button"
          className="theme-btn"
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
    <section className="profile">
      <div className="memory-head">
        <div>
          <p className="eyebrow">Profile</p>
          <h2>{user?.name}</h2>
        </div>
        <button type="button" className="theme-btn" onClick={onBack}>
          Back to chat
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
        <button className="send" type="submit">
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
  }

  async function send(event) {
    event.preventDefault();
    const text = input.trim();
    if (!text || phase !== "idle" || !journeyId) return;

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
          if (evt.type === "memory") {
            setMemory((prev) => ({ ...prev, layers: evt.layers || [], facts: evt.facts || [] }));
            updateAssistant({ memoryLayers: evt.layers || [] });
            if (evt.journey_id) setJourneyId(evt.journey_id);
          } else if (evt.type === "memory_write") {
            setMemory((prev) => ({ ...prev, writes: evt.writes || [] }));
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
      <div className="shell">
        <header className="top">
          <div>
            <p className="eyebrow">Legal AI Assistant</p>
            <h1>Sign in</h1>
          </div>
          <button
            type="button"
            className="theme-btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </header>
        <AuthScreen onAuthed={onAuthed} />
      </div>
    );
  }

  const busy = phase !== "idle";

  return (
    <div className="app-frame">
      <aside className="sidebar">
        <p className="eyebrow">Threads</p>
        <button type="button" className="theme-btn" onClick={newJourney}>
          New journey
        </button>
        <ul className="journey-list">
          {journeys.map((item) => (
            <li key={item.journey_id}>
              <button
                type="button"
                className={item.journey_id === journeyId ? "active" : ""}
                onClick={() => setJourneyId(item.journey_id)}
              >
                <strong>{item.title}</strong>
                <small>{item.journey_id.slice(0, 8)}</small>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="shell">
        <header className="top">
          <div>
            <p className="eyebrow">{user?.email}</p>
            <h1>LangGraph + memory</h1>
          </div>
          <div className="top-actions">
            <span className="badge">{model || "connecting…"}</span>
            <button type="button" className="theme-btn" onClick={() => setView("profile")}>
              Profile
            </button>
            <button
              type="button"
              className="theme-btn"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button type="button" className="theme-btn" onClick={logout}>
              Logout
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
        ) : (
          <>
            <p className="store-line">
              Journey {journeyId ? journeyId.slice(0, 8) : "—"} · Redis{" "}
              {stores?.short_term?.ok ? "on" : "off"} · Mongo {stores?.long_term?.db || "off"}
            </p>
            <MemoryBoard layers={memory.layers} writes={memory.writes} facts={memory.facts} />
            <main className="thread">
              {messages.length === 0 && (
                <div className="empty">
                  <p>This journey is empty. Ask a legal question to start the thread.</p>
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
          </>
        )}
      </div>
    </div>
  );
}
