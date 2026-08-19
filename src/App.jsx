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

const STEP_LABELS = {
  memory: "Memory load",
  rag: "Document search",
  prompt_cache: "Prompt cache",
  analyser: "Query analyser",
  generate: "Answer generator",
  title: "Auto title",
  followups: "Follow-ups",
  orchestrator: "Root agent",
  assistant: "Assistant agent",
  researcher: "Researcher agent",
  draft: "Draft agent",
  document_creator: "Document agent",
  lawyer_finder: "Lawyer finder",
};

const AGENT_LABELS = {
  assistant: "Assistant",
  researcher: "Researcher",
  draft: "Draft",
  document_creator: "Document Creator",
  lawyer_finder: "Lawyer Finder",
};

const GUEST_MODE_KEY = "legal_assist_guest";

const UPLOAD_STEP_LABELS = {
  receive: "Receive file",
  validate: "Validate size",
  parse: "Parse document",
  chunk: "Chunk text",
  mongodb: "MongoDB upload",
  embed: "Embed chunks",
  qdrant: "Qdrant index",
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

function formatBytes(n) {
  const value = Number(n) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

function lastUniqueSteps(steps) {
  const seen = new Map();
  for (const step of steps || []) seen.set(step.name, step);
  return [...seen.values()];
}

function UploadPanel({ job, view, onView }) {
  if (!job || view === "hidden") return null;
  const steps = lastUniqueSteps(job.steps);
  const doneCount = steps.filter((step) => step.status === "done").length;
  const total = Math.max(steps.length, 1);
  const pct = job.error ? 100 : job.done ? 100 : Math.min(100, Math.round((doneCount / Math.max(total, 7)) * 100));
  const title = job.done ? "File ready" : job.error ? "Upload failed" : "Uploading";
  const tone = job.error ? "error" : job.done ? "done" : "running";
  if (view === "mini") {
    return (
      <div className={`stream-mini ${tone}`}>
        <div className="upload-bar thin" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
        <strong>{title}</strong>
        <em>
          {job.filename || "file"} · {pct}%
        </em>
        <span className="stream-actions">
          <button type="button" onClick={() => onView("open")}>
            Expand
          </button>
          <button type="button" onClick={() => onView("hidden")}>
            Hide
          </button>
        </span>
      </div>
    );
  }
  return (
    <div className={`upload-panel compact ${tone}`}>
      <header className="stream-head">
        <div>
          <strong>{title}</strong>
          <em>
            {job.filename || "file"} · {formatBytes(job.bytes)}
          </em>
        </div>
        <span className="stream-actions">
          <button type="button" onClick={() => onView("mini")}>
            Min
          </button>
          <button type="button" onClick={() => onView("hidden")}>
            Hide
          </button>
        </span>
      </header>
      {job.thinking && <p className="trace-think">{job.thinking}</p>}
      <div className="upload-bar thin" aria-hidden="true">
        <span style={{ width: `${pct}%` }} />
      </div>
      {!!steps.length && (
        <ol className="trace-flow compact">
          {steps.map((step) => (
            <li key={step.name} className={step.status}>
              <strong>{UPLOAD_STEP_LABELS[step.name] || step.name}</strong>
              <span>{step.status}</span>
            </li>
          ))}
        </ol>
      )}
      {job.document && (
        <p className="trace-cache write">
          MongoDB · {job.document.chunks} chunks · {job.document.embed_provider || "indexed"}
        </p>
      )}
      {job.error && <p className="error">{job.error}</p>}
    </div>
  );
}

function AnalysisChips({ analysis, cached, routedTo }) {
  if (!analysis && !routedTo) return null;
  const chips = [
    routedTo ? `agent: ${AGENT_LABELS[routedTo] || routedTo}` : null,
    analysis?.intent,
    analysis?.domain,
    analysis?.complexity,
    analysis?.jurisdiction !== "unspecified" ? analysis.jurisdiction : null,
  ].filter(Boolean);
  return (
    <div className="analyser compact">
      <div className="chips">
        {cached && <span className="hit">cached</span>}
        {routedTo && <span className="agent-badge">{AGENT_LABELS[routedTo] || routedTo}</span>}
        {chips.filter(c => c !== `agent: ${AGENT_LABELS[routedTo] || routedTo}`).map((chip) => (
          <span key={chip}>{chip}</span>
        ))}
      </div>
    </div>
  );
}

function TraceCard({ trace, live }) {
  if (!trace) return null;
  const steps = lastUniqueSteps(trace.steps);
  const layers = trace.memoryLayers || [];
  const writes = trace.writes || [];
  const cache = trace.cache;
  const cacheWrite = trace.cacheWrite;
  const retrieval = trace.retrieval;
  const hits = retrieval?.hits || [];
  if (!trace.thinking && !steps.length && !cache && !layers.length && !retrieval) return null;
  return (
    <details className="trace compact" open={!!live}>
      <summary>
        <span>{live ? trace.thinking || "Streaming" : "Run"}</span>
        <em className="trace-pills">
          {cache && <b className={cache.status}>cache {cache.status}</b>}
          {retrieval?.report && <b className={retrieval.report.status}>rag {retrieval.report.status}</b>}
        </em>
      </summary>
      {!!steps.length && (
        <ol className="trace-flow compact">
          {steps.map((step) => (
            <li key={step.name} className={step.status}>
              <strong>{STEP_LABELS[step.name] || step.name}</strong>
              <span>{step.status}</span>
            </li>
          ))}
        </ol>
      )}
      {!!hits.length && (
        <p className="trace-cache hit">
          {hits[0].filename} · {hits[0].score}
          {hits.length > 1 ? ` +${hits.length - 1}` : ""}
        </p>
      )}
      {!!layers.length && (
        <div className="chips">
          {layers.map((layer) => (
            <span key={layer.name} className={layer.status}>
              {layer.label}: {layer.status}
            </span>
          ))}
        </div>
      )}
      {!!writes.length && (
        <div className="chips">
          {writes.map((write) => (
            <span key={write.name || write.store}>
              {write.label || write.name}: {write.wrote ? "ok" : "skip"}
            </span>
          ))}
        </div>
      )}
      {cacheWrite?.detail && <p className="trace-cache write">{cacheWrite.detail}</p>}
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
    { key: "qdrant", label: "Qdrant", hint: "Document vectors" },
  ];
  const fileStore = data.files || {};

  return (
    <section className="panel compact">
      <div className="panel-head">
        <h2>Memory</h2>
        <button type="button" className="ghost" onClick={onBack}>
          Back
        </button>
      </div>
      <p className="memory-gap">
        {data.journey_id ? data.journey_id.slice(0, 8) : "—"} · max 5 MB · {fileStore.bucket || "files"}
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
            </article>
          );
        })}
      </div>

      {!!data.layers?.length && (
        <details className="mem-block" open>
          <summary>This journey</summary>
          <div className="memory-grid four">
            {data.layers.map((layer) => (
              <article key={layer.name} className={`mem-card ${layer.status || "miss"}`}>
                <header>
                  <strong>{layer.label}</strong>
                  <em>{layer.status || "miss"}</em>
                </header>
                <p className="mem-store">{layer.detail}</p>
              </article>
            ))}
          </div>
        </details>
      )}

      {!!data.thread?.length && (
        <details className="mem-block">
          <summary>Thread ({data.thread.length})</summary>
          <div className="memory-facts">
            {data.thread.map((msg, i) => (
              <p key={`${msg.role}-${i}`}>
                <strong>{msg.role}:</strong> {msg.content.slice(0, 120)}
                {msg.content.length > 120 ? "…" : ""}
              </p>
            ))}
          </div>
        </details>
      )}

      <details className="mem-block" open>
        <summary>Files ({data.documents?.length || 0})</summary>
        <div className="memory-facts">
        {!data.documents?.length && <p>No files on this journey.</p>}
        {data.documents?.map((doc) => (
          <article key={doc.doc_id} className="fact-row">
            <header>
              <strong>{doc.filename}</strong>
              <em>{doc.kind}</em>
            </header>
            <p>
              {doc.chunks} chunks · {formatBytes(doc.bytes)}
            </p>
          </article>
        ))}
        </div>
      </details>

      <details className="mem-block">
        <summary>Facts ({data.facts?.length || 0})</summary>
        <div className="memory-facts">
        {!data.facts?.length && <p>No saved facts yet.</p>}
        {data.facts?.map((fact, i) => (
          <article key={`${fact.created_at}-${i}`} className="fact-row">
            <header>
              <strong>{fact.domain || "general"}</strong>
              {fact.created_at && <time>{new Date(fact.created_at).toLocaleString()}</time>}
            </header>
            <p>{fact.summary}</p>
            {fact.journey_id && (
              <button
                type="button"
                className="ghost"
                onClick={() => onOpenJourney(fact.journey_id)}
              >
                Open {fact.journey_id.slice(0, 8)}
              </button>
            )}
          </article>
        ))}
        </div>
      </details>
    </section>
  );
}

function AuthScreen({ onAuthed, onGuest }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("user");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const body = mode === "login"
        ? { email, password }
        : { email, password, name, role };
      const res = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Auth failed");
      localStorage.setItem("legal_assist_token", data.token);
      localStorage.setItem("legal_assist_role", data.user?.role || "user");
      localStorage.removeItem(GUEST_MODE_KEY);
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
          <>
            <label>
              Name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
            </label>
            <label>
              Role
              <select
                className="role-select"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="user">User</option>
                <option value="lawyer">Lawyer</option>
              </select>
            </label>
          </>
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
        <div className="auth-divider">
          <span>or</span>
        </div>
        <button
          type="button"
          className="guest-btn"
          onClick={onGuest}
        >
          Continue as Guest
          <small>Limited to 3 messages · No sign-up required</small>
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
          <dt>Role</dt>
          <dd><span className="role-badge">{user?.role || "user"}</span></dd>
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
  const [token, setToken] = useState(() => {
    const saved = localStorage.getItem("legal_assist_token");
    if (saved) return saved;
    if (localStorage.getItem(GUEST_MODE_KEY)) return "guest";
    return "";
  });
  const [user, setUser] = useState(null);
  const [guestMode, setGuestMode] = useState(() => !!localStorage.getItem(GUEST_MODE_KEY));
  const [guestCount, setGuestCount] = useState(0);
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
  const [docs, setDocs] = useState([]);
  const [uploadJob, setUploadJob] = useState(null);
  const [uploadView, setUploadView] = useState("open");
  const fileRef = useRef(null);
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
    if (!token || guestMode) return;
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
  }, [token, guestMode]);

  useEffect(() => {
    if (!token || !journeyId || guestMode) return;
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
    fetch(`${API}/documents?journey_id=${encodeURIComponent(journeyId)}`, { headers: authHeaders(token) })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.documents && setDocs(data.documents))
      .catch(() => {});
  }, [token, journeyId, guestMode]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, phase, memory, uploadJob]);

  function logout() {
    localStorage.removeItem("legal_assist_token");
    localStorage.removeItem("legal_assist_role");
    localStorage.removeItem(GUEST_MODE_KEY);
    setToken("");
    setUser(null);
    setGuestMode(false);
    setGuestCount(0);
    setJourneys([]);
    setJourneyId("");
    setMessages([]);
    setView("chat");
  }

  function startGuest() {
    localStorage.setItem(GUEST_MODE_KEY, "1");
    setGuestMode(true);
    setGuestCount(0);
    setToken("guest");
    setUser({ name: "Guest", email: "guest@local", role: "guest", user_id: "guest" });
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
    setDocs([]);
    setView("chat");
    setSidebarOpen(false);
  }

  async function uploadFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !journeyId || uploadJob?.running) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`File is larger than 5 MB (${formatBytes(file.size)})`);
      setUploadJob({
        filename: file.name,
        bytes: file.size,
        thinking: "Rejected on the client",
        steps: [{ name: "validate", status: "error", detail: "Larger than 5 MB" }],
        error: "Max upload size is 5 MB",
        done: false,
        running: false,
      });
      return;
    }
    setError("");
    setUploadView("open");
    setUploadJob({
      filename: file.name,
      bytes: file.size,
      thinking: "Starting upload…",
      steps: [],
      mongo: null,
      document: null,
      error: "",
      done: false,
      running: true,
    });
    const body = new FormData();
    body.append("file", file);
    body.append("journey_id", journeyId);
    try {
      const res = await fetch(`${API}/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Upload failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer = parseSseBuffer(buffer + decoder.decode(value, { stream: true }), (evt) => {
          if (evt.type === "thinking") {
            setUploadJob((prev) => ({ ...(prev || {}), thinking: evt.text, running: true }));
          } else if (evt.type === "file") {
            setUploadJob((prev) => ({
              ...(prev || {}),
              filename: evt.filename,
              bytes: evt.bytes,
              running: true,
            }));
          } else if (evt.type === "flow") {
            setUploadJob((prev) => ({ ...(prev || {}), steps: evt.steps || [], running: true }));
          } else if (evt.type === "mongo") {
            setUploadJob((prev) => ({ ...(prev || {}), mongo: evt.report, running: true }));
          } else if (evt.type === "document" || evt.type === "done") {
            if (evt.document) {
              setDocs((prev) => [evt.document, ...prev.filter((item) => item.doc_id !== evt.document.doc_id)]);
            }
            setUploadJob((prev) => ({
              ...(prev || {}),
              document: evt.document || prev?.document,
              done: evt.type === "done",
              running: evt.type !== "done",
              thinking: evt.type === "done" ? "Done." : prev?.thinking,
            }));
          } else if (evt.type === "error") {
            throw new Error(evt.detail || "Upload failed");
          }
        });
      }
      setUploadJob((prev) => (prev ? { ...prev, running: false, done: !prev.error } : prev));
      setUploadView((view) => (view === "hidden" ? "hidden" : "mini"));
    } catch (err) {
      setUploadJob((prev) => ({
        ...(prev || { filename: file.name, bytes: file.size, steps: [] }),
        error: err.message || "Could not upload file",
        running: false,
        done: false,
      }));
      setError(err.message || "Could not upload file");
    }
  }

  async function downloadDoc(doc) {
    if (!doc?.doc_id || !doc.gridfs_id) return;
    const res = await fetch(`${API}/documents/${doc.doc_id}/file`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      setError("Could not download file from MongoDB");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = doc.filename || "document";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function removeDoc(docId) {
    if (!docId) return;
    setError("");
    try {
      const res = await fetch(`${API}/documents/${docId}`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || "Could not delete file");
      }
      setDocs((prev) => prev.filter((item) => item.doc_id !== docId));
    } catch (err) {
      setError(err.message || "Could not delete file");
    }
  }

  async function deleteJourney(id) {
    const target = journeys.find((item) => item.journey_id === id);
    const label = target?.title || "this chat";
    if (!window.confirm(`Delete “${label}”? Files and memory for this thread will be removed.`)) return;
    const res = await fetch(`${API}/journeys/${id}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.detail || "Could not delete chat");
      return;
    }
    const nextList = data.journeys || [];
    setJourneys(nextList);
    const nextId = data.journey?.journey_id || nextList[0]?.journey_id || "";
    setJourneyId(nextId);
    setEditingId("");
    setFollowups([]);
    setUploadJob(null);
    setUploadView("open");
    setDocs([]);
    setMessages([]);
    setView("chat");
    if (id !== nextId && nextId) {
      fetch(`${API}/journeys/${nextId}`, { headers: authHeaders(token) })
        .then((res) => (res.ok ? res.json() : null))
        .then((loaded) => {
          if (loaded?.messages) setMessages(loaded.messages);
        })
        .catch(() => {});
    }
  }

  async function deleteAllJourneys() {
    if (busy || !journeys.length) return;
    if (!window.confirm("Delete all chats? Every chat, file, and memory entry will be removed.")) return;
    setError("");
    try {
      const res = await fetch(`${API}/journeys`, {
        method: "DELETE",
        headers: authHeaders(token),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not delete chats");
      const nextList = data.journeys || (data.journey ? [data.journey] : []);
      setJourneys(nextList);
      setJourneyId(data.journey?.journey_id || nextList[0]?.journey_id || "");
      setEditingId("");
      setFollowups([]);
      setUploadJob(null);
      setUploadView("open");
      setDocs([]);
      setMessages([]);
      setMemory({ layers: [], writes: [], facts: [] });
      setView("chat");
    } catch (err) {
      setError(err.message || "Could not delete chats");
    }
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
    if (!text || phase !== "idle") return;

    // Guest mode: use /chat/guest endpoint
    if (guestMode) {
      if (guestCount >= 3) {
        setError("Guest mode is limited to 3 messages. Please sign up for full access.");
        return;
      }
      const history = [...messages, { role: "user", content: text }];
      setMessages([
        ...history,
        { role: "assistant", content: "", analysis: null, routedTo: null, trace: { thinking: "Starting…", steps: [] } },
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
        const res = await fetch(`${API}/chat/guest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "Request failed");
        updateAssistant({
          content: data.reply || "",
          analysis: data.analysis || null,
          routedTo: data.routed_to || null,
          trace: { thinking: "Done.", steps: [] },
        });
        setGuestCount((c) => c + 1);
        setPhase("idle");
      } catch (err) {
        setError(err.message || "Could not reach the assistant");
        setPhase("idle");
      } finally {
        inputRef.current?.focus();
      }
      return;
    }

    if (!journeyId) return;

    const history = [...messages, { role: "user", content: text }];
    setMessages([
      ...history,
      { role: "assistant", content: "", analysis: null, routedTo: null, trace: { thinking: "Starting…", steps: [], cache: null } },
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
      const res = await fetch(`${API}/chat/stream/v2`, {
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
          } else if (evt.type === "retrieval") {
            updateAssistant((prev) => ({
              trace: {
                ...(prev.trace || {}),
                retrieval: { report: evt.report, hits: evt.hits || [] },
              },
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
          } else if (evt.type === "agent_route") {
            updateAssistant({
              routedTo: evt.routed_to || null,
              analysis: evt.analysis || null,
            });
            setPhase("writing");
          } else if (evt.type === "memory") {
            setMemory((prev) => ({ ...prev, layers: evt.layers || [], facts: evt.facts || [] }));
            updateAssistant((prev) => ({
              memoryLayers: evt.layers || [],
              trace: { ...(prev.trace || {}), memoryLayers: evt.layers || [] },
            }));
            if (evt.journey_id) setJourneyId(evt.journey_id);
          } else if (evt.type === "memory_write") {
            setMemory((prev) => ({ ...prev, writes: evt.writes || [] }));
            updateAssistant((prev) => ({
              trace: { ...(prev.trace || {}), writes: evt.writes || [] },
            }));
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
        <AuthScreen onAuthed={onAuthed} onGuest={startGuest} />
      </div>
    );
  }

  const busy = phase !== "idle" || !!uploadJob?.running;
  const initial = (user?.name || user?.email || "U").slice(0, 1).toUpperCase();

  return (
    <div className="app-frame">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">L</span>
          Legal Assist
        </div>
        {guestMode ? (
          <div className="guest-sidebar-info">
            <p>Guest Mode</p>
            <small>Sign up for full access: memory, file uploads, and unlimited chats.</small>
          </div>
        ) : (
          <>
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
          </>
        )}
        {!guestMode && (
          <>
            <div className="journey-heading">
              <p className="journey-label">Chats</p>
              <button
                type="button"
                className="delete-all-btn"
                disabled={busy || !journeys.length}
                onClick={deleteAllJourneys}
              >
                Delete all
              </button>
            </div>
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
                      <details className="chat-menu">
                        <summary aria-label={`Chat options for ${item.title || "chat"}`}>
                          {"\u22ee"}
                        </summary>
                        <div className="chat-menu-popover">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(item.journey_id);
                              setEditTitle(item.title || "");
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="delete-action"
                            disabled={busy}
                            onClick={() => deleteJourney(item.journey_id)}
                          >
                            Delete
                          </button>
                        </div>
                      </details>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="sidebar-foot">
          <button type="button" className="user-chip" onClick={() => guestMode ? logout() : setView("profile")}>
            <span className="avatar">{initial}</span>
            <span>
              <strong>{user?.name || "Account"}</strong>
              <small>{guestMode ? "Guest mode" : user?.email}</small>
            </span>
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="ghost mobile-only" onClick={() => setSidebarOpen((v) => !v)}>
            Menu
          </button>
          <h1>
            {guestMode
              ? "Guest Chat"
              : journeys.find((item) => item.journey_id === journeyId)?.title || "Legal Assist"}
          </h1>
          <div className="top-actions">
            {guestMode && (
              <span className="guest-badge">{guestCount}/3 messages</span>
            )}
            <button type="button" className="ghost" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}>
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button type="button" className="ghost" onClick={logout}>
              {guestMode ? "Exit guest" : "Log out"}
            </button>
          </div>
        </header>

        {!guestMode && view === "profile" ? (
          <Profile
            user={user}
            journeys={journeys}
            token={token}
            onBack={() => setView("chat")}
            onUser={setUser}
          />
        ) : !guestMode && view === "memory" ? (
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
                    <h2>{guestMode ? "Guest Mode" : "What can I help with?"}</h2>
                    <p>
                      {guestMode
                        ? `Ask up to 3 legal questions. Sign up for unlimited access.`
                        : "Ask a legal question. Memory stays on this journey."}
                    </p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div key={`${msg.role}-${i}`} className={`row ${msg.role}`}>
                    {msg.role === "assistant" && <span className="avatar bot">L</span>}
                    <div className="msg">
                      {msg.role === "assistant" && (
                        <TraceCard
                          trace={msg.trace}
                          live={phase !== "idle" && i === messages.length - 1}
                        />
                      )}
                      {msg.role === "assistant" && (
                        <AnalysisChips
                          analysis={msg.analysis}
                          cached={msg.trace?.cache?.status === "hit"}
                          routedTo={msg.routedTo}
                        />
                      )}
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
              {uploadJob && uploadView === "hidden" && (
                <button type="button" className="stream-restore" onClick={() => setUploadView("mini")}>
                  Show upload · {uploadJob.filename || "file"}
                </button>
              )}
              <UploadPanel job={uploadJob} view={uploadView} onView={setUploadView} />
              {!!docs.length && (
                <div className="doc-chips">
                  {docs.map((doc) => (
                    <span key={doc.doc_id} className="doc-chip">
                      <button type="button" className="doc-open" onClick={() => downloadDoc(doc)} disabled={!doc.gridfs_id}>
                        {doc.filename}
                      </button>
                      <small>{formatBytes(doc.bytes)}</small>
                      <button type="button" onClick={() => removeDoc(doc.doc_id)} aria-label={`Remove ${doc.filename}`}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <form className="composer" onSubmit={send}>
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept=".pdf,.docx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.gif,application/pdf,text/plain,image/*"
                  onChange={uploadFile}
                />
                {!guestMode && (
                  <button
                    type="button"
                    className="attach"
                    disabled={!!uploadJob?.running || !journeyId}
                    onClick={() => fileRef.current?.click()}
                    aria-label="Upload PDF, Word, text, or image"
                  >
                    +
                  </button>
                )}
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  placeholder={guestMode
                    ? `Ask a legal question (${3 - guestCount} remaining)`
                    : "Ask anything, or attach a file (max 5 MB)"}
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
                {guestMode
                  ? "Guest mode · No file upload · 3 messages max · Sign up for full access"
                  : "PDF, DOCX, text, image · max 5 MB · original saved in MongoDB GridFS · vectors in Qdrant"}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
