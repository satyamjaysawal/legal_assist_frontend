import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

/* ── Shared Tailwind class recipes ── */
const BTN_GHOST =
  "cursor-pointer rounded-lg px-2.5 py-1.5 text-sm text-muted transition-colors hover:bg-elev hover:text-ink disabled:cursor-not-allowed disabled:opacity-50";
const BTN_GRADIENT =
  "cursor-pointer rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60";
const INPUT_FIELD =
  "mt-1 w-full rounded-lg border border-line bg-app px-3 py-2 text-sm text-ink outline-none transition placeholder:text-faint focus:border-accent focus:ring-2 focus:ring-accent/30";
const CHIP =
  "rounded-full border border-line bg-elev px-2 py-0.5 text-[11px] text-muted";
const SUMMARY = "cursor-pointer select-none font-semibold";

/* ── Markdown renderer styling (Tailwind only) ── */
const MD_COMPONENTS = {
  p: ({ node, ...props }) => <p className="mb-1.5 leading-relaxed last:mb-0" {...props} />,
  ul: ({ node, ...props }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5" {...props} />,
  ol: ({ node, ...props }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5" {...props} />,
  li: ({ node, ...props }) => <li className="leading-snug" {...props} />,
  strong: ({ node, ...props }) => <strong className="font-bold" {...props} />,
  em: ({ node, ...props }) => <em className="italic" {...props} />,
  code: ({ node, ...props }) => (
    <code className="rounded bg-elev px-1.5 py-0.5 font-mono text-[0.9em]" {...props} />
  ),
  pre: ({ node, ...props }) => (
    <pre className="my-1.5 overflow-x-auto rounded-lg bg-elev p-3 [&_code]:bg-transparent [&_code]:p-0" {...props} />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote className="my-1.5 border-l-[3px] border-accent px-3 text-muted" {...props} />
  ),
  h1: ({ node, ...props }) => <h1 className="mb-1 mt-2 text-[1.3em] font-semibold" {...props} />,
  h2: ({ node, ...props }) => <h2 className="mb-1 mt-2 text-[1.15em] font-semibold" {...props} />,
  h3: ({ node, ...props }) => <h3 className="mb-1 mt-2 text-[1.05em] font-semibold" {...props} />,
  hr: ({ node, ...props }) => <hr className="my-2 border-line" {...props} />,
  a: ({ node, ...props }) => (
    <a className="text-accent underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />
  ),
  table: ({ node, ...props }) => (
    <table className="my-2 w-full border-collapse text-sm [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-line [&_th]:bg-elev [&_th]:px-2 [&_th]:py-1" {...props} />
  ),
};

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
  email: "Email agent",
  lawyer_finder: "Lawyer finder",
};

const AGENT_LABELS = {
  assistant: "Assistant",
  researcher: "Researcher",
  draft: "Draft",
  document_creator: "Document Creator",
  email: "Email",
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

function stepTone(status) {
  if (status === "done") return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (status === "running") return "animate-pulse border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  if (status === "error") return "border-red-500/40 bg-red-500/10 text-danger";
  return "border-line bg-elev text-faint";
}

function ProgressBar({ pct, tone }) {
  const fill =
    tone === "error"
      ? "bg-gradient-to-r from-red-500 to-rose-500"
      : "bg-gradient-to-r from-emerald-500 to-teal-500";
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-line" aria-hidden="true">
      <span className={`block h-full rounded-full transition-all duration-300 ${fill}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function UploadPanel({ job, view, onView }) {
  if (!job || view === "hidden") return null;
  const steps = lastUniqueSteps(job.steps);
  const doneCount = steps.filter((step) => step.status === "done").length;
  const total = Math.max(steps.length, 1);
  const pct = job.error ? 100 : job.done ? 100 : Math.min(100, Math.round((doneCount / Math.max(total, 7)) * 100));
  const title = job.done ? "File ready" : job.error ? "Upload failed" : "Uploading";
  const tone = job.error ? "error" : job.done ? "done" : "running";
  const toneClass =
    tone === "error"
      ? "border-red-500/40"
      : tone === "done"
        ? "border-emerald-500/40"
        : "border-line";
  const miniAction =
    "cursor-pointer rounded-md px-2 py-0.5 text-[11px] text-muted transition-colors hover:bg-side-hover hover:text-ink";
  if (view === "mini") {
    return (
      <div className={`mb-2 space-y-1 rounded-xl border ${toneClass} bg-elev px-3 py-2 text-xs animate-fade`}>
        <ProgressBar pct={pct} tone={tone} />
        <div className="flex flex-wrap items-center gap-2">
          <strong>{title}</strong>
          <em className="not-italic text-faint">
            {job.filename || "file"} · {pct}%
          </em>
          <span className="ml-auto flex gap-1">
            <button type="button" className={miniAction} onClick={() => onView("open")}>
              Expand
            </button>
            <button type="button" className={miniAction} onClick={() => onView("hidden")}>
              Hide
            </button>
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className={`mb-2 space-y-2 rounded-2xl border ${toneClass} bg-elev p-3 text-xs animate-fade`}>
      <header className="flex items-start justify-between gap-2">
        <div>
          <strong className="text-sm">{title}</strong>
          <em className="block not-italic text-faint">
            {job.filename || "file"} · {formatBytes(job.bytes)}
          </em>
        </div>
        <span className="flex gap-1">
          <button type="button" className={miniAction} onClick={() => onView("mini")}>
            Min
          </button>
          <button type="button" className={miniAction} onClick={() => onView("hidden")}>
            Hide
          </button>
        </span>
      </header>
      {job.thinking && <p className="italic text-muted">{job.thinking}</p>}
      <ProgressBar pct={pct} tone={tone} />
      {!!steps.length && (
        <ol className="flex flex-wrap gap-1.5">
          {steps.map((step) => (
            <li
              key={step.name}
              className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${stepTone(step.status)}`}
            >
              <strong className="font-medium">{UPLOAD_STEP_LABELS[step.name] || step.name}</strong>
              <span>{step.status}</span>
            </li>
          ))}
        </ol>
      )}
      {job.document && (
        <p className="text-[11px] text-indigo-500 dark:text-indigo-400">
          MongoDB · {job.document.chunks} chunks · {job.document.embed_provider || "indexed"}
        </p>
      )}
      {job.error && <p className="text-danger">{job.error}</p>}
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
    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
      {cached && <span className={`${CHIP} border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`}>cached</span>}
      {routedTo && (
        <span className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
          {AGENT_LABELS[routedTo] || routedTo}
        </span>
      )}
      {chips
        .filter((c) => c !== `agent: ${AGENT_LABELS[routedTo] || routedTo}`)
        .map((chip) => (
          <span key={chip} className={CHIP}>
            {chip}
          </span>
        ))}
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
  const cachePill = (status, label) => (
    <b
      className={`rounded-full border px-2 py-0.5 font-medium ${
        status === "hit"
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-line bg-elev text-faint"
      }`}
    >
      {label} {status}
    </b>
  );
  return (
    <details className="mb-1.5 rounded-xl border border-line bg-elev/60 text-xs" open={!!live}>
      <summary className={`${SUMMARY} flex items-center justify-between gap-2 px-3 py-2 font-medium text-muted`}>
        <span>{live ? trace.thinking || "Streaming" : "Run"}</span>
        <em className="flex gap-1.5 not-italic">
          {cache && cachePill(cache.status, "cache")}
          {retrieval?.report && cachePill(retrieval.report.status, "rag")}
        </em>
      </summary>
      <div className="space-y-2 px-3 pb-2.5">
        {!!steps.length && (
          <ol className="flex flex-wrap gap-1.5">
            {steps.map((step) => (
              <li
                key={step.name}
                className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 ${stepTone(step.status)}`}
              >
                <strong className="font-medium">{STEP_LABELS[step.name] || step.name}</strong>
                <span>{step.status}</span>
              </li>
            ))}
          </ol>
        )}
        {!!hits.length && (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
            {hits[0].filename} · {hits[0].score}
            {hits.length > 1 ? ` +${hits.length - 1}` : ""}
          </p>
        )}
        {!!layers.length && (
          <div className="flex flex-wrap gap-1.5">
            {layers.map((layer) => (
              <span key={layer.name} className={`${CHIP} ${layer.status === "hit" ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : ""}`}>
                {layer.label}: {layer.status}
              </span>
            ))}
          </div>
        )}
        {!!writes.length && (
          <div className="flex flex-wrap gap-1.5">
            {writes.map((write) => (
              <span key={write.name || write.store} className={CHIP}>
                {write.label || write.name}: {write.wrote ? "ok" : "skip"}
              </span>
            ))}
          </div>
        )}
        {cacheWrite?.detail && <p className="text-[11px] text-indigo-500 dark:text-indigo-400">{cacheWrite.detail}</p>}
      </div>
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
      <section className="mx-auto w-full max-w-3xl p-6">
        <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-danger">{error}</p>
        <button type="button" className={BTN_GHOST} onClick={onBack}>
          Back
        </button>
      </section>
    );
  }
  if (!data) return <p className="p-6 text-sm text-muted animate-pulse">Loading memory…</p>;

  const stores = [
    { key: "in_memory", label: "In-memory", hint: "Process RAM" },
    { key: "short_term", label: "Short-term", hint: "Redis" },
    { key: "long_term", label: "Long-term", hint: "MongoDB" },
    { key: "semantic", label: "Semantic", hint: "Qdrant vectors" },
    { key: "prompt_cache", label: "Prompt cache", hint: "Redis + RAM" },
    { key: "qdrant", label: "Qdrant", hint: "Document vectors" },
  ];
  const fileStore = data.files || {};
  const profile = data.profile || {};

  const memBlock = "rounded-xl border border-line bg-elev/50";
  const memSummary = `${SUMMARY} px-4 py-2.5 text-sm text-ink transition-colors hover:text-accent`;
  const memBody = "space-y-1.5 px-4 pb-3 text-sm";
  const factRow = "space-y-1 rounded-lg border border-line bg-app p-3";

  return (
    <section className="mx-auto w-full max-w-3xl space-y-3 p-4 sm:p-6 animate-fade">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Memory</h2>
        <button type="button" className={BTN_GHOST} onClick={onBack}>
          Back
        </button>
      </div>
      <p className="text-xs text-faint">
        {data.journey_id ? data.journey_id.slice(0, 8) : "—"} · max 5 MB · {fileStore.bucket || "files"}
      </p>

      {(profile.name || profile.email || profile.phone || profile.facts?.length) && (
        <details className={memBlock} open>
          <summary className={memSummary}>Your Profile</summary>
          <div className={memBody}>
            {profile.name && <p><strong>Name:</strong> {profile.name}</p>}
            {profile.email && <p><strong>Email:</strong> {profile.email}</p>}
            {profile.phone && <p><strong>Phone:</strong> {profile.phone}</p>}
            {profile.facts?.length > 0 && (
              <div>
                <strong>Facts:</strong>
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
                  {profile.facts.map((fact, i) => (
                    <li key={i}>{fact}</li>
                  ))}
                </ul>
              </div>
            )}
            {profile.updated_at && (
              <p className="text-xs text-faint">
                Last updated: {new Date(profile.updated_at).toLocaleString()}
              </p>
            )}
          </div>
        </details>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {stores.map((store) => {
          const item = data.stores?.[store.key] || {};
          return (
            <article
              key={store.key}
              className={`rounded-xl border p-3 transition-colors ${
                item.ok ? "border-emerald-500/40 bg-emerald-500/5" : "border-red-500/30 bg-red-500/5"
              }`}
            >
              <header className="flex items-center justify-between">
                <strong className="text-sm">{store.label}</strong>
                <em className={`not-italic text-xs font-bold ${item.ok ? "text-emerald-600 dark:text-emerald-400" : "text-danger"}`}>
                  {item.ok ? "ON" : "OFF"}
                </em>
              </header>
              <p className="mt-1 text-xs text-muted">{store.hint}</p>
            </article>
          );
        })}
      </div>

      {data.procedural && (
        <details className={memBlock} open>
          <summary className={memSummary}>Preferences (Procedural Memory)</summary>
          <div className={memBody}>
            {data.procedural.language && <p><strong>Language:</strong> {data.procedural.language}</p>}
            {data.procedural.tone && <p><strong>Tone:</strong> {data.procedural.tone}</p>}
            {data.procedural.format && <p><strong>Format:</strong> {data.procedural.format}</p>}
            {data.procedural.jurisdiction && <p><strong>Jurisdiction:</strong> {data.procedural.jurisdiction}</p>}
            {data.procedural.interaction_count && <p><strong>Interactions:</strong> {data.procedural.interaction_count}</p>}
            {data.procedural.updated_at && (
              <p className="text-xs text-faint">
                Last updated: {new Date(data.procedural.updated_at).toLocaleString()}
              </p>
            )}
          </div>
        </details>
      )}

      {!!data.episodes?.length && (
        <details className={memBlock}>
          <summary className={memSummary}>Episodes ({data.episodes.length})</summary>
          <div className={`${memBody} space-y-2`}>
            {data.episodes.map((ep, i) => (
              <article key={`${ep.created_at}-${i}`} className={factRow}>
                <header className="flex items-center justify-between gap-2">
                  <strong className="text-sm">{ep.domain || "general"}</strong>
                  {ep.created_at && <time className="text-[11px] text-faint">{new Date(ep.created_at).toLocaleString()}</time>}
                </header>
                <p className="text-muted">{ep.summary || ep.query}</p>
                {ep.topics?.length > 0 && (
                  <p className="flex flex-wrap gap-1">
                    {ep.topics.slice(0, 5).map((t) => (
                      <span key={t} className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] text-accent">
                        {t}
                      </span>
                    ))}
                  </p>
                )}
                {ep.journey_id && (
                  <button type="button" className={BTN_GHOST} onClick={() => onOpenJourney(ep.journey_id)}>
                    Open {ep.journey_id.slice(0, 8)}
                  </button>
                )}
              </article>
            ))}
          </div>
        </details>
      )}

      {!!data.layers?.length && (
        <details className={memBlock} open>
          <summary className={memSummary}>This journey</summary>
          <div className="grid grid-cols-1 gap-2 px-4 pb-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.layers.map((layer) => (
              <article
                key={layer.name}
                className={`rounded-xl border p-3 ${
                  layer.status === "hit" ? "border-emerald-500/40 bg-emerald-500/5" : "border-line bg-app"
                }`}
              >
                <header className="flex items-center justify-between">
                  <strong className="text-sm">{layer.label}</strong>
                  <em className="not-italic text-xs text-muted">{layer.status || "miss"}</em>
                </header>
                <p className="mt-1 text-xs text-muted">{layer.detail}</p>
              </article>
            ))}
          </div>
        </details>
      )}

      {!!data.thread?.length && (
        <details className={memBlock}>
          <summary className={memSummary}>Thread ({data.thread.length})</summary>
          <div className={memBody}>
            {data.thread.map((msg, i) => (
              <p key={`${msg.role}-${i}`}>
                <strong>{msg.role}:</strong> {msg.content.slice(0, 120)}
                {msg.content.length > 120 ? "…" : ""}
              </p>
            ))}
          </div>
        </details>
      )}

      <details className={memBlock} open>
        <summary className={memSummary}>Files ({data.documents?.length || 0})</summary>
        <div className={`${memBody} space-y-2`}>
          {!data.documents?.length && <p className="text-muted">No files on this journey.</p>}
          {data.documents?.map((doc) => (
            <article key={doc.doc_id} className={factRow}>
              <header className="flex items-center justify-between gap-2">
                <strong className="truncate text-sm">{doc.filename}</strong>
                <em className="not-italic text-xs text-faint">{doc.kind}</em>
              </header>
              <p className="text-muted">
                {doc.chunks} chunks · {formatBytes(doc.bytes)}
              </p>
            </article>
          ))}
        </div>
      </details>

      <details className={memBlock}>
        <summary className={memSummary}>Facts ({data.facts?.length || 0})</summary>
        <div className={`${memBody} space-y-2`}>
          {!data.facts?.length && <p className="text-muted">No saved facts yet.</p>}
          {data.facts?.map((fact, i) => (
            <article key={`${fact.created_at}-${i}`} className={factRow}>
              <header className="flex items-center justify-between gap-2">
                <strong className="text-sm">{fact.domain || "general"}</strong>
                {fact.created_at && <time className="text-[11px] text-faint">{new Date(fact.created_at).toLocaleString()}</time>}
              </header>
              <p className="text-muted">{fact.summary}</p>
              {fact.journey_id && (
                <button type="button" className={BTN_GHOST} onClick={() => onOpenJourney(fact.journey_id)}>
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
    <form
      className="w-full max-w-sm space-y-3 rounded-2xl border border-line bg-elev p-6 shadow-2xl animate-rise"
      onSubmit={submit}
    >
      <div className="flex items-center gap-2.5 pb-1 font-semibold">
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 via-teal-500 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-emerald-500/30">
          L
        </span>
        Legal Assist
      </div>
      <h1 className="text-xl font-bold">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      {mode === "register" && (
        <>
          <label className="block text-sm text-muted">
            Name
            <input
              className={INPUT_FIELD}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </label>
          <label className="block text-sm text-muted">
            Role
            <select className={INPUT_FIELD} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user">User</option>
              <option value="lawyer">Lawyer</option>
            </select>
          </label>
        </>
      )}
      <label className="block text-sm text-muted">
        Email
        <input
          className={INPUT_FIELD}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm text-muted">
        Password
        <input
          className={INPUT_FIELD}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </label>
      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <button className={`${BTN_GRADIENT} w-full py-2.5`} type="submit" disabled={busy}>
        {busy ? "Please wait…" : mode === "login" ? "Continue" : "Create account"}
      </button>
      <button
        type="button"
        className="w-full cursor-pointer text-center text-sm text-muted transition-colors hover:text-ink"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login" ? "Need an account?" : "Have an account?"}
      </button>
      <div className="flex items-center gap-3 text-xs text-faint before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
        <span>or</span>
      </div>
      <button
        type="button"
        className="flex w-full cursor-pointer flex-col items-center rounded-xl border border-line py-2.5 text-sm transition-colors hover:bg-side-hover"
        onClick={onGuest}
      >
        Continue as Guest
        <small className="text-[11px] text-faint">Limited to 3 messages · No sign-up required</small>
      </button>
    </form>
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
    <section className="mx-auto w-full max-w-3xl space-y-4 p-4 sm:p-6 animate-fade">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{user?.name || "Profile"}</h2>
        <button type="button" className={BTN_GHOST} onClick={onBack}>
          Back
        </button>
      </div>
      <dl className="grid grid-cols-1 gap-3 rounded-2xl border border-line bg-elev/50 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-faint">Email</dt>
          <dd className="m-0 text-sm">{user?.email}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-faint">Role</dt>
          <dd className="m-0">
            <span className="rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-2.5 py-0.5 text-xs font-semibold text-white">
              {user?.role || "user"}
            </span>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-faint">User ID</dt>
          <dd className="m-0 text-sm">{user?.user_id}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-faint">Threads</dt>
          <dd className="m-0 text-sm">{journeys.length}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-faint">Joined</dt>
          <dd className="m-0 text-sm">{user?.created_at ? new Date(user.created_at).toLocaleString() : "—"}</dd>
        </div>
      </dl>
      <form className="flex flex-wrap items-end gap-3" onSubmit={save}>
        <label className="block min-w-56 flex-1 text-sm text-muted">
          Display name
          <input className={INPUT_FIELD} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button className={`${BTN_GRADIENT} px-5 py-2.5`} type="submit">
          Save profile
        </button>
        {note && <p className="w-full text-sm text-muted">{note}</p>}
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
  const [agents, setAgents] = useState([]);
  const [connectors, setConnectors] = useState([]);
  const [showAgents, setShowAgents] = useState(false);
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
  const [mailModal, setMailModal] = useState(false);
  const [mailBody, setMailBody] = useState("");
  const [mailForm, setMailForm] = useState({ to: "", cc: "", bcc: "", subject: "" });
  const [mailStatus, setMailStatus] = useState("");
  const [downloadOpen, setDownloadOpen] = useState("");
  const [copiedMsgIdx, setCopiedMsgIdx] = useState(-1);
  const [fillModal, setFillModal] = useState(null);
  const [fillValues, setFillValues] = useState({});
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardInput, setWizardInput] = useState("");
  const [wizardChat, setWizardChat] = useState([]);
  const [wizardDone, setWizardDone] = useState(false);
  const wizardInputRef = useRef(null);

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
        if (data?.agents) setAgents(data.agents);
        if (data?.connectors) setConnectors(data.connectors);
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

  useEffect(() => {
    const el = document.getElementById("wizard-chat");
    if (el) el.scrollTop = el.scrollHeight;
  }, [wizardChat, wizardStep, wizardDone]);

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

  async function exportContent(content, format, title) {
    if (!content) return;
    try {
      const res = await fetch(`${API}/export/download`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ content, format, title: title || "Legal Document" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Export failed");
      }
      const blob = await res.blob();
      const ext = format === "pdf" ? ".pdf" : format === "docx" ? ".docx" : ".txt";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = (title || "Legal Document").replace(/\s+/g, "_") + ext;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || "Export failed");
    }
  }

  function openMailModal(content) {
    // Try to extract Subject from content
    const subjectMatch = content.match(/\*?\*?Subject:?\*?\*?\s*(.+)/i);
    const subject = subjectMatch ? subjectMatch[1].trim() : "";
    setMailBody(content);
    setMailForm({ to: "", cc: "", bcc: "", subject });
    setMailStatus("");
    setMailModal(true);
  }

  async function sendMail() {
    if (!mailForm.to.trim()) {
      setMailStatus("Please enter at least one recipient email.");
      return;
    }
    setMailStatus("sending");
    try {
      const res = await fetch(`${API}/email/send`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          to: mailForm.to.split(",").map((e) => e.trim()).filter(Boolean),
          cc: mailForm.cc ? mailForm.cc.split(",").map((e) => e.trim()).filter(Boolean) : [],
          bcc: mailForm.bcc ? mailForm.bcc.split(",").map((e) => e.trim()).filter(Boolean) : [],
          subject: mailForm.subject || "(No subject)",
          body: mailBody,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Failed to send email");
      setMailStatus("sent");
      setTimeout(() => setMailModal(false), 1500);
    } catch (err) {
      setMailStatus(`error: ${err.message}`);
    }
  }

  /* ── Copy to clipboard ── */
  async function copyMessage(content, idx) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMsgIdx(idx);
      setTimeout(() => setCopiedMsgIdx(-1), 2000);
    } catch { /* fallback: ignore */ }
  }

  /* ── Placeholder detection ── */
  function detectPlaceholders(content) {
    if (!content) return [];
    const re = /\[([^\]\[\n]{1,60}?)\]/g;
    const seen = new Set();
    const fields = [];
    let m;
    while ((m = re.exec(content))) {
      const raw = m[1].trim();
      if (!raw || raw.startsWith("http") || raw.startsWith("#")) continue;
      const key = raw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      fields.push(raw);
    }
    return fields;
  }

  function replacePlaceholders(content, values) {
    let result = content;
    for (const [key, val] of Object.entries(values)) {
      if (!val?.trim()) continue;
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(`\\[\\s*${escaped}\\s*\\]`, "g"), val.trim());
    }
    return result;
  }

  function handleDownloadWithFields(content, format, title, idx) {
    const fields = detectPlaceholders(content);
    if (fields.length > 0) {
      const vals = {};
      fields.forEach((f) => (vals[f] = ""));
      setFillModal({ type: "download", content, format, title, fields, msgIdx: idx });
      setFillValues(vals);
    } else {
      exportContent(content, format, title);
    }
    setDownloadOpen("");
  }

  function handleEmailWithFields(content, idx) {
    const fields = detectPlaceholders(content);
    if (fields.length > 0) {
      const vals = {};
      fields.forEach((f) => (vals[f] = ""));
      setFillModal({ type: "email", content, fields, msgIdx: idx });
      setFillValues(vals);
    } else {
      openMailModal(content);
    }
  }

  function confirmFillFields() {
    if (!fillModal) return;
    const filled = replacePlaceholders(fillModal.content, fillValues);
    if (fillModal.type === "download") {
      exportContent(filled, fillModal.format, fillModal.title);
    } else {
      openMailModal(filled);
    }
    setFillModal(null);
    setFillValues({});
  }

  function allFieldsFilled() {
    return Object.values(fillValues).every((v) => v && v.trim());
  }

  /* ── Draft Fill Agent (HITL wizard) ── */
  function wizardAskAnswer() {
    if (!fillModal || !wizardInput.trim()) return;
    const field = fillModal.fields[wizardStep];
    const value = wizardInput.trim();
    const newValues = { ...fillValues, [field]: value };
    setFillValues(newValues);
    setWizardChat((prev) => [
      ...prev,
      { role: "agent", field, question: `What is the ${field}?` },
      { role: "user", field, value },
    ]);
    setWizardInput("");
    if (wizardStep + 1 >= fillModal.fields.length) {
      setWizardDone(true);
    } else {
      setWizardStep(wizardStep + 1);
    }
  }

  function wizardEdit(idx) {
    setWizardStep(idx);
    setWizardDone(false);
    setWizardInput(fillValues[fillModal.fields[idx]] || "");
    setWizardChat((prev) => prev.slice(0, idx * 2));
    setTimeout(() => wizardInputRef.current?.focus(), 50);
  }

  function wizardPrev() {
    if (wizardStep > 0) {
      const prev = wizardStep - 1;
      setWizardStep(prev);
      setWizardDone(false);
      setWizardInput(fillValues[fillModal.fields[prev]] || "");
      setWizardChat((prevChat) => prevChat.slice(0, prev * 2));
    }
  }

  function wizardSkip() {
    if (!fillModal) return;
    if (wizardStep + 1 >= fillModal.fields.length) {
      setWizardDone(true);
    } else {
      setWizardStep(wizardStep + 1);
    }
  }

  function wizardClose() {
    setFillModal(null);
    setFillValues({});
    setWizardStep(0);
    setWizardInput("");
    setWizardChat([]);
    setWizardDone(false);
  }

  function wizardConfirm() {
    confirmFillFields();
    wizardClose();
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
      if (!assembled.trim()) throw new Error("The assistant returned an empty response. The AI model may be unavailable — please try again in a moment.");
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
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-app p-4 text-ink">
        {/* Decorative gradient blobs */}
        <div className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 size-96 rounded-full bg-indigo-500/15 blur-3xl" />
        <button
          type="button"
          className={`${BTN_GHOST} absolute right-4 top-4`}
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
    <div className="grid h-screen overflow-hidden bg-app text-ink md:grid-cols-[260px_minmax(0,1fr)]">
      <aside
        className={`flex-col border-r border-line bg-side px-2 pb-3 pt-2.5 ${
          sidebarOpen ? "fixed inset-y-0 left-0 z-20 flex w-72 max-w-[86vw] shadow-2xl" : "hidden"
        } md:static md:flex md:w-auto md:max-w-none md:shadow-none`}
      >
        <div className="flex items-center gap-2.5 px-2.5 pb-3.5 pt-2.5 font-semibold">
          <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 via-teal-500 to-indigo-600 text-sm font-bold text-white shadow-md shadow-emerald-500/30">
            L
          </span>
          Legal Assist
        </div>
        {guestMode ? (
          <div className="mx-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <p className="m-0 font-semibold">Guest Mode</p>
            <small className="mt-1 block text-xs text-muted">
              Sign up for full access: memory, file uploads, and unlimited chats.
            </small>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm transition-colors hover:bg-side-hover"
              onClick={newJourney}
            >
              + New chat
            </button>
            <button
              type="button"
              className={`mt-2 w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-side-hover ${
                view === "memory" ? "bg-side-hover font-medium" : ""
              }`}
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
            <div className="flex items-center justify-between">
              <p className="mx-3 mb-1.5 mt-4 text-[11px] uppercase tracking-wide text-faint">Chats</p>
              <button
                type="button"
                className="cursor-pointer rounded-md px-1.5 py-1 text-[11px] text-faint transition-colors hover:bg-elev hover:text-danger disabled:cursor-not-allowed disabled:opacity-45"
                disabled={busy || !journeys.length}
                onClick={deleteAllJourneys}
              >
                Delete all
              </button>
            </div>
            <ul className="m-0 flex-1 list-none overflow-auto p-0">
              {journeys.map((item) => (
                <li
                  key={item.journey_id}
                  className={`mb-0.5 rounded-xl transition-colors hover:bg-side-hover ${
                    item.journey_id === journeyId ? "bg-side-hover" : ""
                  }`}
                >
                  {editingId === item.journey_id ? (
                    <form
                      className="p-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        renameCurrent(item.journey_id, editTitle);
                      }}
                    >
                      <input
                        className="w-full rounded-lg border border-accent bg-app px-2.5 py-1.5 text-sm outline-none ring-2 ring-accent/25"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                        onBlur={() => renameCurrent(item.journey_id, editTitle)}
                      />
                    </form>
                  ) : (
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        className="min-w-0 flex-1 cursor-pointer truncate rounded-xl border-0 bg-transparent px-3 py-2.5 text-left transition-colors hover:bg-side-hover"
                        onClick={() => {
                          setJourneyId(item.journey_id);
                          setFollowups([]);
                          setView("chat");
                          setSidebarOpen(false);
                        }}
                      >
                        <strong className="font-medium">{item.title}</strong>
                      </button>
                      <details className="relative shrink-0">
                        <summary
                          aria-label={`Chat options for ${item.title || "chat"}`}
                          className="grid size-6 cursor-pointer place-items-center rounded-lg text-lg leading-none text-faint transition-colors hover:bg-elev hover:text-ink open:bg-elev open:text-ink"
                        >
                          ⋮
                        </summary>
                        <div className="absolute right-0 top-7 z-10 min-w-28 rounded-lg border border-line bg-elev p-1 shadow-xl animate-fade">
                          <button
                            type="button"
                            className="w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-side-hover"
                            onClick={() => {
                              setEditingId(item.journey_id);
                              setEditTitle(item.title || "");
                            }}
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            className="w-full cursor-pointer rounded-md px-2 py-1.5 text-left text-[13px] text-danger transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="mt-auto pt-2">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-side-hover"
            onClick={() => (guestMode ? logout() : setView("profile"))}
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow">
              {initial}
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-sm">{user?.name || "Account"}</strong>
              <small className="block truncate text-xs text-faint">{guestMode ? "Guest mode" : user?.email}</small>
            </span>
          </button>
        </div>
      </aside>

      <div className="flex h-screen min-w-0 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <button
            type="button"
            className={`${BTN_GHOST} md:hidden`}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            Menu
          </button>
          <h1 className="m-0 min-w-0 truncate text-base font-semibold">
            {guestMode
              ? "Guest Chat"
              : journeys.find((item) => item.journey_id === journeyId)?.title || "Legal Assist"}
          </h1>
          <div className="flex shrink-0 items-center gap-1.5">
            {guestMode && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                {guestCount}/3 messages
              </span>
            )}
            <button
              type="button"
              className={`${BTN_GHOST} ${showAgents ? "bg-accent/15 text-accent" : ""}`}
              onClick={() => setShowAgents((v) => !v)}
              title="Show agents"
            >
              Agents {showAgents ? "ON" : "OFF"}
            </button>
            <button
              type="button"
              className={`${BTN_GHOST} hidden sm:inline-flex`}
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            >
              {theme === "dark" ? "Light" : "Dark"}
            </button>
            <button type="button" className={BTN_GHOST} onClick={logout}>
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
            {showAgents && (
              <div className="border-b border-line bg-elev/40 px-4 py-3 animate-fade">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="m-0 text-sm font-semibold">Registered Agents</h3>
                  <button type="button" className={BTN_GHOST} onClick={() => setShowAgents(false)}>
                    Hide
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {agents.map((agent) => (
                    <article
                      key={agent.name}
                      className="rounded-xl border border-line bg-app p-3 transition-transform hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <header className="flex items-center justify-between gap-2">
                        <strong className="truncate text-sm capitalize">{agent.name}</strong>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white ${
                            agent.name === "orchestrator"
                              ? "bg-gradient-to-r from-indigo-500 to-violet-600"
                              : "bg-gradient-to-r from-emerald-500 to-teal-600"
                          }`}
                        >
                          {agent.name === "orchestrator" ? "Root" : "Specialist"}
                        </span>
                      </header>
                      <p className="mb-1.5 mt-1 text-xs text-muted">{agent.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {agent.handles?.map((h) => (
                          <span key={h} className={CHIP}>
                            {h}
                          </span>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
                {!!connectors.length && (
                  <details className="mt-3" open>
                    <summary className={`${SUMMARY} text-xs text-muted`}>Connectors ({connectors.length})</summary>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {connectors.map((conn) => (
                        <div
                          key={conn.name}
                          className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                            conn.available
                              ? "border-emerald-500/40 bg-emerald-500/10"
                              : "border-line bg-elev opacity-70"
                          }`}
                        >
                          <span className={`size-1.5 rounded-full ${conn.available ? "bg-emerald-500" : "bg-faint"}`} />
                          <strong className="font-medium">{conn.name}</strong>
                          <span className="text-faint">{conn.available ? "Available" : "Not configured"}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
            <main className="flex-1 overflow-auto">
              <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
                {messages.length === 0 && (
                  <div className="pt-16 text-center animate-fade">
                    <h2 className="m-0 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 bg-clip-text text-3xl font-bold text-transparent">
                      {guestMode ? "Guest Mode" : "What can I help with?"}
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                      {guestMode
                        ? `Ask up to 3 legal questions. Sign up for unlimited access.`
                        : "Ask a legal question. Memory stays on this journey."}
                    </p>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={`${msg.role}-${i}`}
                    className={`flex animate-rise ${msg.role === "user" ? "justify-end" : "gap-2.5"}`}
                  >
                    {msg.role === "assistant" && (
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 via-teal-500 to-indigo-600 text-xs font-bold text-white shadow">
                        L
                      </span>
                    )}
                    <div
                      className={`min-w-0 max-w-[min(680px,100%)] ${
                        msg.role === "user" ? "rounded-3xl bg-bubble px-4 py-2.5" : "flex-1 pt-0.5"
                      }`}
                    >
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
                      <div className="m-0 text-[15px]">
                        {msg.content ? (
                          msg.role === "assistant" ? (
                            <div className="leading-normal">
                              <ReactMarkdown components={MD_COMPONENTS}>{msg.content}</ReactMarkdown>
                            </div>
                          ) : (
                            msg.content
                          )
                        ) : (
                          phase === "analysing" ? (
                            <span className="text-muted animate-pulse">{msg.trace?.thinking || "Thinking…"}</span>
                          ) : (
                            ""
                          )
                        )}
                      </div>
                      {msg.role === "assistant" && msg.content && (
                        <div className="mt-1.5">
                          <button
                            type="button"
                            className={`flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors ${
                              copiedMsgIdx === i ? "text-emerald-500" : "text-faint hover:bg-elev hover:text-ink"
                            }`}
                            onClick={() => copyMessage(msg.content, i)}
                            title={copiedMsgIdx === i ? "Copied!" : "Copy to clipboard"}
                          >
                            {copiedMsgIdx === i ? (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                Copied
                              </>
                            ) : (
                              <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                      )}
                      {msg.role === "assistant" && msg.content && ["draft", "document_creator", "email"].includes(msg.routedTo) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <div className="relative">
                            <button
                              type="button"
                              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-sm font-medium text-white shadow transition hover:brightness-110 active:scale-95"
                              onClick={() => setDownloadOpen(downloadOpen === `msg-${i}` ? "" : `msg-${i}`)}
                            >
                              <span>⬇</span> Download
                            </button>
                            {downloadOpen === `msg-${i}` && (
                              <div className="absolute left-0 top-full z-10 mt-1 w-44 rounded-xl border border-line bg-elev p-1 shadow-xl animate-fade">
                                <button
                                  type="button"
                                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-side-hover"
                                  onClick={() => handleDownloadWithFields(msg.content, "pdf", msg.analysis?.summary || "Legal Document", i)}
                                >
                                  <span className="grid size-5 place-items-center rounded bg-red-500 text-[10px] font-bold text-white">P</span>
                                  PDF Document
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-side-hover"
                                  onClick={() => handleDownloadWithFields(msg.content, "docx", msg.analysis?.summary || "Legal Document", i)}
                                >
                                  <span className="grid size-5 place-items-center rounded bg-blue-500 text-[10px] font-bold text-white">W</span>
                                  Word (DOCX)
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors hover:bg-side-hover"
                                  onClick={() => handleDownloadWithFields(msg.content, "txt", msg.analysis?.summary || "Legal Document", i)}
                                >
                                  <span className="grid size-5 place-items-center rounded bg-neutral-500 text-[10px] font-bold text-white">T</span>
                                  Plain Text
                                </button>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-elev px-3 py-1.5 text-sm font-medium transition hover:bg-side-hover active:scale-95"
                            onClick={() => handleEmailWithFields(msg.content, i)}
                          >
                            <span>✉</span> Send Email
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {phase === "writing" && <p className="text-sm text-muted animate-pulse">Streaming…</p>}
                {error && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-danger">
                    {error}
                  </p>
                )}
                {!!followups.length && phase === "idle" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="m-0 text-xs uppercase tracking-wide text-faint">Follow up</p>
                    {followups.map((q) => (
                      <button
                        key={q}
                        type="button"
                        className="cursor-pointer rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm text-accent transition hover:bg-accent/20 active:scale-95"
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
            <div className="border-t border-line px-4 pb-3 pt-2">
              {uploadJob && uploadView === "hidden" && (
                <button
                  type="button"
                  className="mb-2 cursor-pointer rounded-lg border border-line bg-elev px-3 py-1.5 text-xs text-muted transition-colors hover:bg-side-hover hover:text-ink"
                  onClick={() => setUploadView("mini")}
                >
                  Show upload · {uploadJob.filename || "file"}
                </button>
              )}
              <UploadPanel job={uploadJob} view={uploadView} onView={setUploadView} />
              {!!docs.length && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {docs.map((doc) => (
                    <span
                      key={doc.doc_id}
                      className="flex items-center gap-1.5 rounded-full border border-line bg-elev py-1 pl-3 pr-1 text-xs"
                    >
                      <button
                        type="button"
                        className="max-w-48 cursor-pointer truncate bg-transparent font-medium transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => downloadDoc(doc)}
                        disabled={!doc.gridfs_id}
                      >
                        {doc.filename}
                      </button>
                      <small className="text-faint">{formatBytes(doc.bytes)}</small>
                      <button
                        type="button"
                        className="grid size-5 cursor-pointer place-items-center rounded-full text-faint transition-colors hover:bg-red-500/15 hover:text-danger"
                        onClick={() => removeDoc(doc.doc_id)}
                        aria-label={`Remove ${doc.filename}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <form
                className="flex items-end gap-2 rounded-2xl border border-line bg-elev p-2 transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25"
                onSubmit={send}
              >
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
                    className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl text-lg text-muted transition-colors hover:bg-side-hover hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
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
                  className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-faint"
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
                <button
                  className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                >
                  ↑
                </button>
              </form>
              <p className="mt-1.5 text-center text-[11px] text-faint">
                {guestMode
                  ? "Guest mode · No file upload · 3 messages max · Sign up for full access"
                  : "PDF, DOCX, text, image · max 5 MB · original saved in MongoDB GridFS · vectors in Qdrant"}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Draft Fill Agent (HITL Wizard) ── */}
      {fillModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-app p-4" onClick={wizardClose}>
          <div
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-elev shadow-2xl animate-rise"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line px-5 py-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-xl shadow-lg shadow-emerald-500/25">
                {fillModal.type === "download" ? "📄" : "✉"}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="m-0 text-base font-bold">Draft Fill Agent</h3>
                <p className="m-0 text-xs text-muted">
                  I’ll guide you through {fillModal.fields.length} field{fillModal.fields.length !== 1 ? "s" : ""} to personalize this {fillModal.type === "download" ? "document" : "email"}.
                </p>
              </div>
              <div className="shrink-0 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 px-3 py-1 text-xs font-bold text-white shadow">
                {Math.min(wizardStep + (wizardDone ? 1 : 0), fillModal.fields.length)} / {fillModal.fields.length}
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-auto px-5 py-4">
              <div id="wizard-chat" className="h-60 space-y-3 overflow-auto rounded-xl border border-line bg-app p-3">
                {wizardChat.length === 0 && !wizardDone && (
                  <div className="space-y-1 text-sm text-muted animate-fade">
                    <p className="m-0">Hi! I’ll help you fill this document step by step.</p>
                    <p className="m-0">Let’s start with the first field.</p>
                  </div>
                )}
                {wizardChat.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex items-end gap-2 animate-rise ${msg.role === "user" ? "justify-end" : ""}`}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-elev text-sm">
                      {msg.role === "agent" ? "🤖" : "👤"}
                    </span>
                    <div
                      className={`relative max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === "agent"
                          ? "rounded-bl-sm border border-neutral-200 bg-white text-neutral-900"
                          : "rounded-br-sm bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow"
                      }`}
                    >
                      {msg.role === "agent" ? <span>{msg.question}</span> : <span>{msg.value}</span>}
                      {msg.role === "user" && (
                        <button
                          type="button"
                          className="ml-2 cursor-pointer text-white/80 transition-colors hover:text-white"
                          onClick={() => wizardEdit(Math.floor(idx / 2))}
                          title="Edit this answer"
                        >
                          ✎
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!wizardDone && fillModal.fields[wizardStep] && (
                  <div className="flex items-end gap-2 animate-rise">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-elev text-sm">🤖</span>
                    <div className="max-w-[75%] rounded-2xl rounded-bl-sm border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm">
                      <strong>
                        What is <em className="text-accent">{fillModal.fields[wizardStep]}</em>?
                      </strong>
                    </div>
                  </div>
                )}
                {wizardDone && (
                  <div className="flex items-end gap-2 animate-rise">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-elev text-sm">🤖</span>
                    <div className="max-w-[75%] rounded-2xl rounded-bl-sm border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm">
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        All {fillModal.fields.length} fields are filled!
                      </strong>
                      <p className="m-0 mt-0.5 text-muted">
                        Review the preview below, then {fillModal.type === "download" ? "download" : "continue to email"}.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {!wizardDone && fillModal.fields[wizardStep] && (
                <div className="flex gap-2">
                  <input
                    ref={wizardInputRef}
                    type="text"
                    className={INPUT_FIELD.replace("mt-1 ", "")}
                    placeholder={`Enter ${fillModal.fields[wizardStep]}...`}
                    value={wizardInput}
                    onChange={(e) => setWizardInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") wizardAskAnswer();
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    className={`${BTN_GRADIENT} shrink-0 px-4 py-2 text-sm`}
                    onClick={wizardAskAnswer}
                    disabled={!wizardInput.trim()}
                  >
                    Next →
                  </button>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {fillModal.fields.map((f, i) => (
                  <button
                    key={f}
                    type="button"
                    className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs transition ${
                      fillValues[f]?.trim()
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-line bg-elev text-muted"
                    } ${i === wizardStep && !wizardDone ? "ring-2 ring-accent/40" : ""}`}
                    onClick={() => wizardEdit(i)}
                  >
                    <span className="mr-1">{fillValues[f]?.trim() ? "✓" : "○"}</span>
                    {f}
                  </button>
                ))}
              </div>

              <details className="rounded-xl border border-line bg-app">
                <summary className={`${SUMMARY} px-4 py-2.5 text-sm`}>👁 Preview document</summary>
                <div className="max-h-64 overflow-auto border-t border-line px-6 py-4 font-serif text-sm leading-relaxed">
                  {replacePlaceholders(fillModal.content, fillValues).split("\n").map((line, i) => {
                    const t = line.trim();
                    if (!t) return <br key={i} />;
                    if (/^#{1,2}\s/.test(t))
                      return (
                        <h3 key={i} className="mb-2 mt-3 text-center text-lg font-bold">
                          {t.replace(/^#+\s*/, "")}
                        </h3>
                      );
                    if (/^#{3,}\s/.test(t))
                      return (
                        <h4 key={i} className="mb-1 mt-2 font-bold">
                          {t.replace(/^#+\s*/, "")}
                        </h4>
                      );
                    if (/^\*\*.*\*\*$/.test(t))
                      return (
                        <p key={i} className="my-1 font-bold">
                          {t.replace(/\*\*/g, "")}
                        </p>
                      );
                    if (/^\d+\.\s/.test(t)) return <p key={i} className="my-1 pl-2">{line}</p>;
                    if (/^[-*]\s/.test(t)) return <p key={i} className="my-0.5 pl-6">{line}</p>;
                    return <p key={i} className="my-1">{line}</p>;
                  })}
                </div>
              </details>
            </div>

            <div className="space-y-3 border-t border-line px-5 py-4">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 transition-all duration-300"
                  style={{ width: `${((wizardStep + (wizardDone ? 1 : 0)) / fillModal.fields.length) * 100}%` }}
                />
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {wizardStep > 0 && !wizardDone && (
                  <button type="button" className={BTN_GHOST} onClick={wizardPrev}>
                    ← Prev
                  </button>
                )}
                {!wizardDone && (
                  <button type="button" className={BTN_GHOST} onClick={wizardSkip}>
                    Skip →
                  </button>
                )}
                <button type="button" className={BTN_GHOST} onClick={wizardClose}>
                  Cancel
                </button>
                <button
                  type="button"
                  className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] ${
                    allFieldsFilled()
                      ? "bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/25"
                      : "bg-gradient-to-r from-amber-500 to-orange-600 shadow-amber-500/25"
                  }`}
                  onClick={wizardConfirm}
                >
                  {allFieldsFilled()
                    ? (fillModal.type === "download" ? "✓ Download Now" : "✓ Continue to Email")
                    : (fillModal.type === "download" ? "Download as-is" : "Continue as-is")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Mail Modal ── */}
      {mailModal && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-app p-4" onClick={() => setMailModal(false)}>
          <div
            className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-elev shadow-2xl animate-rise"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h3 className="m-0 text-base font-bold">✉ Send Email</h3>
              <button type="button" className={BTN_GHOST} onClick={() => setMailModal(false)}>
                ✕
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-auto px-5 py-4">
              <label className="block text-sm text-muted">
                <span>To</span>
                <input
                  className={INPUT_FIELD}
                  type="email"
                  placeholder="recipient@example.com (comma-separated for multiple)"
                  value={mailForm.to}
                  onChange={(e) => setMailForm({ ...mailForm, to: e.target.value })}
                />
              </label>
              <label className="block text-sm text-muted">
                <span>Subject</span>
                <input
                  className={INPUT_FIELD}
                  type="text"
                  placeholder="Email subject"
                  value={mailForm.subject}
                  onChange={(e) => setMailForm({ ...mailForm, subject: e.target.value })}
                />
              </label>
              <details className="rounded-xl border border-line bg-app">
                <summary className={`${SUMMARY} px-3 py-2 text-xs text-muted`}>CC / BCC</summary>
                <div className="space-y-3 px-3 pb-3">
                  <label className="block text-sm text-muted">
                    <span>CC</span>
                    <input
                      className={INPUT_FIELD}
                      type="email"
                      placeholder="cc@example.com"
                      value={mailForm.cc}
                      onChange={(e) => setMailForm({ ...mailForm, cc: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm text-muted">
                    <span>BCC</span>
                    <input
                      className={INPUT_FIELD}
                      type="email"
                      placeholder="bcc@example.com"
                      value={mailForm.bcc}
                      onChange={(e) => setMailForm({ ...mailForm, bcc: e.target.value })}
                    />
                  </label>
                </div>
              </details>
              <label className="block text-sm text-muted">
                <span>Body</span>
                <textarea
                  className={`${INPUT_FIELD} resize-y`}
                  rows={10}
                  value={mailBody}
                  onChange={(e) => setMailBody(e.target.value)}
                />
              </label>
            </div>
            <div className="border-t border-line px-5 py-4">
              {mailStatus === "sending" && (
                <span className="mb-2 inline-block rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-600 dark:text-amber-400 animate-pulse">
                  Sending…
                </span>
              )}
              {mailStatus === "sent" && (
                <span className="mb-2 inline-block rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-600 dark:text-emerald-400">
                  ✓ Email sent!
                </span>
              )}
              {mailStatus && mailStatus.startsWith("error") && (
                <span className="mb-2 inline-block rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-danger">
                  {mailStatus.replace("error: ", "")}
                </span>
              )}
              {mailStatus && !mailStatus.startsWith("error") && mailStatus !== "sending" && mailStatus !== "sent" && (
                <span className="mb-2 inline-block rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs text-danger">
                  {mailStatus}
                </span>
              )}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-app px-3 py-1.5 text-sm font-medium transition hover:bg-side-hover active:scale-95"
                  onClick={() => { exportContent(mailBody, "pdf", mailForm.subject || "Email"); }}
                >
                  ⬇ PDF
                </button>
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-app px-3 py-1.5 text-sm font-medium transition hover:bg-side-hover active:scale-95"
                  onClick={() => { exportContent(mailBody, "docx", mailForm.subject || "Email"); }}
                >
                  ⬇ DOCX
                </button>
                <button
                  type="button"
                  className={`${BTN_GRADIENT} px-4 py-2 text-sm`}
                  disabled={mailStatus === "sending"}
                  onClick={sendMail}
                >
                  {mailStatus === "sending" ? "Sending…" : "Send Email →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
