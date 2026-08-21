import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ProgressBar } from "./components/ui/ProgressBar";
import { Guidebook } from "./components/Guidebook";
import { LadyJusticeArt } from "./components/LadyJustice";
import ladyJusticePng from "./assets/lady-justice.png";
import { API_BASE_URL as API, websocketBaseUrl } from "./config/api";
import { AGENT_LABELS, GUEST_MODE_KEY, MAX_UPLOAD_BYTES, STEP_LABELS, UPLOAD_STEP_LABELS } from "./constants/agents";
import { formatBytes, formatTime as fmtWhen, lastUniqueSteps } from "./lib/formatters";
import { authHeaders } from "./lib/http";
import { parseSseBuffer } from "./lib/streaming";
import { BTN_GHOST, BTN_GRADIENT, CHIP, INPUT_FIELD, SUMMARY } from "./styles/classes";

// Production is intentionally pinned to the deployed API. Local development
// may set VITE_API_URL, or leave it empty to use the Vite proxy.

/* ── Shared Tailwind class recipes ── */

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
  h1: ({ node, ...props }) => (
    <h1 className="mb-1.5 mt-3 border-b border-line/70 pb-1 text-[1.3em] font-bold tracking-tight" {...props} />
  ),
  h2: ({ node, ...props }) => <h2 className="mb-1 mt-2.5 text-[1.15em] font-bold tracking-tight" {...props} />,
  h3: ({ node, ...props }) => <h3 className="mb-1 mt-2 text-[1.05em] font-semibold" {...props} />,
  hr: ({ node, ...props }) => <hr className="my-2 border-line" {...props} />,
  a: ({ node, ...props }) => (
    <a className="text-accent underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />
  ),
  table: ({ node, ...props }) => (
    <div className="my-2.5 overflow-x-auto rounded-xl border border-line bg-elev/60 shadow-sm">
      <table className="w-full border-collapse text-[13px] leading-snug" {...props} />
    </div>
  ),
  thead: ({ node, ...props }) => (
    <thead className="bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-indigo-500/10" {...props} />
  ),
  th: ({ node, ...props }) => (
    <th className="border-b border-line px-3 py-2 text-left font-semibold" {...props} />
  ),
  td: ({ node, ...props }) => (
    <td className="border-b border-line/60 px-3 py-2 align-top" {...props} />
  ),
  tbody: ({ node, ...props }) => (
    <tbody className="[&>tr:last-child>td]:border-b-0 [&>tr:nth-child(even)]:bg-elev/70" {...props} />
  ),
};

function Icon({ name, className = "" }) {
  const common = { className, width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (name === "menu") return <svg {...common}><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></svg>;
  if (name === "collapse") return <svg {...common}><path d="m15 18-6-6 6-6" /><path d="M20 4v16" /></svg>;
  if (name === "expand") return <svg {...common}><path d="m9 18 6-6-6-6" /><path d="M4 4v16" /></svg>;
  if (name === "overview") return <svg {...common}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>;
  if (name === "agents") return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 11a3 3 0 0 0 0-6" /><path d="M20.5 20a5.5 5.5 0 0 0-3.5-5.1" /></svg>;
  if (name === "guide") return <svg {...common}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /></svg>;
  if (name === "memory") return <svg {...common}><path d="M12 2a5 5 0 0 0-5 5v1a4 4 0 0 0-3 3.9V14a4 4 0 0 0 3 3.9V19a3 3 0 0 0 3 3h4a3 3 0 0 0 3-3v-1.1A4 4 0 0 0 20 14v-2.1A4 4 0 0 0 17 8V7a5 5 0 0 0-5-5Z" /><path d="M12 2v20M8 10h.01M16 10h.01M8 15h.01M16 15h.01" /></svg>;
  if (name === "plus") return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
  if (name === "lawyer") return <svg {...common}><path d="M12 3 3 7l9 4 9-4-9-4Z" /><path d="M6 9.2V14c2.4 2 9.6 2 12 0V9.2" /><path d="M21 7v7" /><path d="M19.5 17h3" /></svg>;
  if (name === "upload") return <svg {...common}><path d="M12 16V3" /><path d="m7 8 5-5 5 5" /><path d="M5 21h14" /></svg>;
  if (name === "send") return <svg {...common}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>;
  if (name === "sun") return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>;
  if (name === "moon") return <svg {...common}><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.6 6.6 0 0 0 21 12.8Z" /></svg>;
  if (name === "logout") return <svg {...common}><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M21 3v18" /></svg>;
  return null;
}

function readTheme() {
  const saved = localStorage.getItem("legal_assist_theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function stepTone(status) {
  if (status === "done" || status === "hit" || status === "cached")
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (status === "running") return "animate-pulse border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  if (status === "error" || status === "failed") return "border-red-500/40 bg-red-500/10 text-danger";
  return "border-line bg-elev text-faint";
}

const STATUS_META = {
  done: { icon: "✓", cls: "border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  hit: { icon: "✓", cls: "border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  cached: { icon: "⚡", cls: "border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  running: { icon: "●", cls: "animate-pulse border-amber-500/50 bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  error: { icon: "✕", cls: "border-red-500/50 bg-red-500/15 text-danger" },
  failed: { icon: "✕", cls: "border-red-500/50 bg-red-500/15 text-danger" },
  miss: { icon: "○", cls: "border-line bg-elev text-faint" },
  skip: { icon: "↷", cls: "border-line bg-elev text-faint" },
};

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
    analysis?.intent && `intent: ${analysis.intent}`,
    analysis?.domain && `domain: ${analysis.domain}`,
    analysis?.complexity && `complexity: ${analysis.complexity}`,
    analysis?.jurisdiction && analysis.jurisdiction !== "unspecified" ? `jurisdiction: ${analysis.jurisdiction}` : null,
  ].filter(Boolean);
  return (
    <div className="mb-2 rounded-xl border border-line bg-elev/50 p-2.5 text-xs animate-fade">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-faint">
          🧠 Intent classification
        </span>
        {cached && (
          <span className={`${CHIP} border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`}>
            cached
          </span>
        )}
        {chips.map((chip) => (
          <span key={chip} className={CHIP}>
            {chip}
          </span>
        ))}
      </div>
      {analysis?.summary && (
        <p className="m-0 mt-1.5 text-muted">
          <strong className="text-ink">Understood as:</strong> {analysis.summary}
        </p>
      )}
      {analysis?.refined_query && analysis.refined_query !== analysis.summary && (
        <p className="m-0 mt-0.5 text-muted">
          <strong className="text-ink">Refined query:</strong> {analysis.refined_query}
        </p>
      )}
      {routedTo && (
        <p className="m-0 mt-1.5 flex flex-wrap items-center gap-1.5 text-muted">
          <strong className="text-ink">Route:</strong>
          <span className={CHIP}>Root orchestrator</span>
          <span className="font-bold text-accent">→</span>
          <span className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-2 py-0.5 text-[11px] font-semibold text-white shadow-sm">
            {AGENT_LABELS[routedTo] || routedTo}
          </span>
        </p>
      )}
    </div>
  );
}

function StageNode({ stage, childrenMap, depth }) {
  const kids = childrenMap.get(stage.stage_id) || [];
  const meta = STATUS_META[stage.status] || STATUS_META.miss;
  return (
    <li className="relative pb-1.5 pl-5 last:pb-0">
      <span className="absolute left-[7px] top-0 h-full w-px bg-line" aria-hidden="true" />
      <span className="absolute left-[7px] top-[13px] h-px w-3 bg-line" aria-hidden="true" />
      <details className="rounded-lg border border-line bg-app/70 px-2 py-1.5" open={depth < 1}>
        <summary className={`${SUMMARY} flex flex-wrap items-center gap-1.5`}>
          <span className={`grid size-[17px] shrink-0 place-items-center rounded-full border text-[9px] font-bold ${meta.cls}`}>
            {meta.icon}
          </span>
          <strong className="text-[11.5px] text-ink">
            {AGENT_LABELS[stage.agent] || STEP_LABELS[stage.agent] || stage.agent}
          </strong>
          <span className="font-mono text-[9px] text-faint">{stage.stage_id}</span>
          <span className={`rounded-full border px-1.5 py-px text-[9px] ${stepTone(stage.status)}`}>{stage.status}</span>
        </summary>
        <div className="mt-1.5 space-y-1.5 border-t border-line pt-1.5">
          {stage.input ? (
            <div>
              <p className="m-0 text-[9px] font-bold uppercase tracking-wide text-faint">📥 Received (hand-off into this agent)</p>
              <pre className="m-0 max-h-36 overflow-auto whitespace-pre-wrap rounded bg-elev p-1.5 font-mono text-[10px] leading-snug text-muted">{stage.input}</pre>
            </div>
          ) : null}
          {stage.reply ? (
            <div>
              <p className="m-0 text-[9px] font-bold uppercase tracking-wide text-faint">
                📤 Produced{stage.truncated ? " (truncated for display)" : ""} — passed to the next agent
              </p>
              <pre className="m-0 max-h-36 overflow-auto whitespace-pre-wrap rounded bg-elev p-1.5 font-mono text-[10px] leading-snug text-muted">{stage.reply}</pre>
            </div>
          ) : (
            <p className="m-0 text-[10px] italic text-faint">Still generating…</p>
          )}
        </div>
      </details>
      {!!kids.length && (
        <ul className="m-0 mt-1.5 list-none p-0">
          {kids.map((kid) => (
            <StageNode key={kid.stage_id} stage={kid} childrenMap={childrenMap} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

function AgentFlowTree({ stages }) {
  if (!stages?.length) return null;
  const byId = new Map(stages.map((s) => [s.stage_id, s]));
  const childrenMap = new Map();
  const roots = [];
  for (const s of stages) {
    if (s.parent_stage_id && byId.has(s.parent_stage_id)) {
      childrenMap.set(s.parent_stage_id, [...(childrenMap.get(s.parent_stage_id) || []), s]);
    } else {
      roots.push(s);
    }
  }
  return (
    <div className="rounded-lg border border-accent/30 bg-accent/5 p-2">
      <p className="m-0 mb-1.5 text-[10px] font-bold uppercase tracking-wide text-faint">
        🌳 Agent flow tree — what each agent received and produced
      </p>
      <ul className="m-0 list-none p-0">
        {roots.map((root) => (
          <StageNode key={root.stage_id} stage={root} childrenMap={childrenMap} depth={0} />
        ))}
      </ul>
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
  const workflow = trace.workflow;
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
    <details className="mb-2 overflow-hidden rounded-xl border border-line bg-elev/60 text-xs" open>
      <summary className={`${SUMMARY} flex items-center justify-between gap-2 px-3 py-2`}>
        <span className="flex items-center gap-2 text-ink">
          <span className="grid size-5 place-items-center rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 text-[10px] text-white shadow-sm">
            ⚙
          </span>
          Agent Pipeline
          <span className="rounded-full bg-elev px-1.5 py-0.5 text-[10px] font-medium text-faint">
            {steps.length} step{steps.length !== 1 ? "s" : ""}
          </span>
        </span>
        <em className="max-w-[55%] truncate not-italic text-muted">
          {live ? trace.thinking || "Streaming…" : "Completed"}
        </em>
      </summary>
      <div className="space-y-2 border-t border-line px-3 pb-3 pt-2.5">
        {(cache || retrieval?.report) && (
          <div className="flex flex-wrap gap-1.5">
            {cache && cachePill(cache.status, "cache")}
            {retrieval?.report && cachePill(retrieval.report.status, "rag")}
          </div>
        )}
        {workflow && (
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-2 text-[11px] text-muted">
            <strong className="text-ink">{workflow.label || "Workflow"}:</strong> {workflow.pattern}
            {!!workflow.stages?.length && <span> · {workflow.stages.join(" → ")}</span>}
          </div>
        )}
        <AgentFlowTree stages={trace.stages} />
        {!!steps.length && (
          <ol className="m-0 list-none space-y-0 p-0">
            {steps.map((step, idx) => {
              const meta = STATUS_META[step.status] || STATUS_META.miss;
              return (
                <li key={step.name} className="relative flex gap-2.5 pb-2 last:pb-0 animate-fade">
                  {idx < steps.length - 1 && (
                    <span className="absolute left-[9px] top-5 h-[calc(100%-14px)] w-px bg-line" aria-hidden="true" />
                  )}
                  <span
                    className={`z-[1] grid size-[19px] shrink-0 place-items-center rounded-full border text-[10px] font-bold ${meta.cls}`}
                  >
                    {meta.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <strong className="text-[12px] font-semibold text-ink">
                        {STEP_LABELS[step.display_name || step.name] || AGENT_LABELS[step.display_name || step.name] || step.display_name || step.name}
                      </strong>
                      <span className={`rounded-full border px-1.5 py-px text-[10px] ${stepTone(step.status)}`}>
                        {step.status}
                      </span>
                    </div>
                    {step.detail && <p className="m-0 text-[11px] leading-snug text-muted">{step.detail}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {!!hits.length && (
          <p className="m-0 text-[11px] text-emerald-600 dark:text-emerald-400">
            📄 {hits[0].filename} · score {hits[0].score}
            {hits.length > 1 ? ` +${hits.length - 1} more` : ""}
          </p>
        )}
        {!!layers.length && (
          <div>
            <p className="m-0 mb-1 text-[10px] font-bold uppercase tracking-wide text-faint">🗂 Memory reads</p>
            <div className="flex flex-wrap gap-1.5">
              {layers.map((layer) => (
                <span
                  key={layer.name}
                  title={`${layer.detail || ""} · ${layer.store || ""}`}
                  className={`${CHIP} ${layer.status === "hit" ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : ""}`}
                >
                  {layer.label}: {layer.status}
                  {layer.when ? ` · ${fmtWhen(layer.when)}` : ""}
                </span>
              ))}
            </div>
          </div>
        )}
        {!!writes.length && (
          <div>
            <p className="m-0 mb-1 text-[10px] font-bold uppercase tracking-wide text-faint">💾 Memory writes</p>
            <div className="flex flex-wrap gap-1.5">
              {writes.map((write) => (
                <span
                  key={write.name || write.store}
                  title={write.detail || ""}
                  className={`${CHIP} ${write.wrote ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : ""}`}
                >
                  {write.label || write.name}: {write.wrote ? "saved" : "skip"}
                  {write.when ? ` · ${fmtWhen(write.when)}` : ""}
                </span>
              ))}
            </div>
          </div>
        )}
        {cacheWrite?.detail && <p className="m-0 text-[11px] text-indigo-500 dark:text-indigo-400">{cacheWrite.detail}</p>}
      </div>
    </details>
  );
}

function SqlCard({ sqlInfo }) {
  if (!sqlInfo?.sql) return null;
  return (
    <details className="mb-2 overflow-hidden rounded-xl border border-indigo-500/30 bg-elev/60 text-xs animate-fade" open>
      <summary className={`${SUMMARY} flex flex-wrap items-center gap-2 px-3 py-2`}>
        <span className="flex items-center gap-2 text-ink">
          <span className="grid size-5 place-items-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-[10px] text-white shadow-sm">
            🗄
          </span>
          Executed SQL
        </span>
        <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
          {sqlInfo.rowCount} row{(sqlInfo.rowCount ?? 0) !== 1 ? "s" : ""} fetched
        </span>
        {(sqlInfo.tables || []).map((t) => (
          <span key={t} className={`${CHIP} border-indigo-500/30 text-indigo-500 dark:text-indigo-400`}>
            {t}
          </span>
        ))}
      </summary>
      <div className="border-t border-line">
        <pre className="m-0 overflow-x-auto bg-app px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-ink whitespace-pre-wrap">
          {sqlInfo.sql}
        </pre>
        {!!sqlInfo.columns?.length && (
          <p className="m-0 flex flex-wrap items-center gap-1 border-t border-line px-3 py-1.5 text-[10px] text-faint">
            Columns:
            {sqlInfo.columns.map((c) => (
              <span key={c} className={CHIP}>
                {c}
              </span>
            ))}
          </p>
        )}
      </div>
    </details>
  );
}

const GUARD_STATUS_META = {
  passed: { icon: "✅", label: "passed", chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  enforced: { icon: "🛡️", label: "enforced", chip: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  blocked: { icon: "⛔", label: "blocked", chip: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400" },
};

function GuardrailCard({ guardrails }) {
  if (!guardrails?.length) return null;
  const blocked = guardrails.filter((g) => g.status === "blocked").length;
  return (
    <details className="mb-2 overflow-hidden rounded-xl border border-amber-500/30 bg-elev/60 text-xs animate-fade" open>
      <summary className={`${SUMMARY} flex flex-wrap items-center gap-2 px-3 py-2`}>
        <span className="flex items-center gap-2 text-ink">
          <span className="grid size-5 place-items-center rounded-md bg-gradient-to-br from-amber-500 to-rose-600 text-[10px] text-white shadow-sm">
            🛡
          </span>
          Guardrails
        </span>
        <span className="rounded-full border border-line bg-app px-2 py-0.5 text-[10px] font-medium text-muted">
          {guardrails.length} check{guardrails.length !== 1 ? "s" : ""}
        </span>
        {blocked > 0 && (
          <span className="rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400">
            {blocked} blocked
          </span>
        )}
      </summary>
      <ul className="m-0 list-none space-y-1.5 border-t border-line px-3 py-2.5">
        {guardrails.map((g, i) => {
          const meta = GUARD_STATUS_META[g.status] || GUARD_STATUS_META.enforced;
          return (
            <li key={`${g.name}-${i}`} className="flex flex-wrap items-start gap-2">
              <span className={`${CHIP} ${meta.chip} shrink-0`}>
                {meta.icon} {g.name} · {meta.label}
              </span>
              <span className="min-w-0 flex-1 text-muted">{g.detail}</span>
              {g.agent && <span className={`${CHIP} border-line text-faint`}>{AGENT_LABELS[g.agent] || g.agent}</span>}
            </li>
          );
        })}
      </ul>
    </details>
  );
}

const HITL_DECISION_META = {
  approve: { icon: "✅", label: "Approved", chip: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  reject: { icon: "❌", label: "Rejected", chip: "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  changes: { icon: "✏️", label: "Changes requested", chip: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  regenerate: { icon: "🔁", label: "Regeneration requested", chip: "border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
};

function ApprovalCard({ hitl, busy, onDecide }) {
  const [option, setOption] = useState("");
  const [comment, setComment] = useState("");
  if (!hitl?.requestId) return null;
  const decided = hitl.status === "decided";
  const decidedMeta = HITL_DECISION_META[hitl.decision];
  const decide = (decision) => {
    if (busy || decided) return;
    onDecide(decision, comment.trim());
  };
  return (
    <div className="mb-2 overflow-hidden rounded-xl border border-violet-500/40 bg-elev/60 text-xs shadow-md shadow-violet-500/10 animate-fade">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <span className="grid size-5 place-items-center rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 text-[10px] text-white shadow-sm">
          🙋
        </span>
        <span className="text-[13px] font-semibold text-ink">Human approval required</span>
        <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400">
          {decided ? "decided" : "paused — waiting for you"}
        </span>
      </div>
      <div className="space-y-2.5 px-3 py-2.5">
        <p className="m-0 text-[13px] text-ink">{hitl.question}</p>
        {!!hitl.draft && (
          <details className="overflow-hidden rounded-lg border border-line" open={!decided}>
            <summary className={`${SUMMARY} px-3 py-1.5`}>📄 Review the draft</summary>
            <pre className="m-0 max-h-64 overflow-auto whitespace-pre-wrap bg-app px-3 py-2 font-mono text-[11.5px] leading-relaxed text-muted">
              {hitl.draft}
            </pre>
          </details>
        )}
        {decided ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className={`${CHIP} ${decidedMeta?.chip || "border-line text-muted"}`}>
              {decidedMeta?.icon} {decidedMeta?.label || hitl.decision}
            </span>
            {!!hitl.comment && <span className="min-w-0 flex-1 text-muted">“{hitl.comment}”</span>}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => decide("approve")}
                className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-600 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-400"
              >
                ✅ Yes, approve
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide("reject")}
                className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-3 py-1.5 text-[12px] font-semibold text-rose-600 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-400"
              >
                ❌ No, reject
              </button>
              <select
                value={option}
                disabled={busy}
                onChange={(e) => setOption(e.target.value)}
                className="rounded-lg border border-line bg-app px-2.5 py-1.5 text-[12px] text-ink disabled:opacity-50"
              >
                <option value="">Other…</option>
                {(hitl.options || [])
                  .filter((o) => o.id !== "approve" && o.id !== "reject")
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
              </select>
              {!!option && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => decide(option)}
                  className="rounded-lg border border-indigo-500/50 bg-indigo-500/10 px-3 py-1.5 text-[12px] font-semibold text-indigo-600 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50 dark:text-indigo-400"
                >
                  Apply
                </button>
              )}
            </div>
            <textarea
              value={comment}
              disabled={busy}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Comments / what should change (optional)…"
              rows={2}
              className="w-full resize-y rounded-lg border border-line bg-app px-2.5 py-1.5 text-[12px] text-ink placeholder:text-faint focus:border-violet-500/60 focus:outline-none disabled:opacity-50"
            />
          </>
        )}
      </div>
    </div>
  );
}

function LawyerChatModal({ token, userId, journeyId, onClose }) {
  const [lawyers, setLawyers] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | connecting | live | closed | error
  const [chat, setChat] = useState([]);
  const [draft, setDraft] = useState("");
  const [wsError, setWsError] = useState("");
  const wsRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    fetch(`${API}/lawyers`, { headers: authHeaders(token) })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Could not load the lawyer directory"))))
      .then((data) => setLawyers(data.lawyers || []))
      .catch((err) => setLoadError(err.message));
    return () => {
      try {
        wsRef.current?.close();
      } catch {
        /* already closed */
      }
    };
  }, [token]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  async function startChat(lawyer) {
    setSelected(lawyer);
    setStatus("connecting");
    setChat([]);
    setWsError("");
    try {
      const res = await fetch(`${API}/lawyer/rooms`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          lawyer_id: String(lawyer.id ?? lawyer.bar_council_id ?? lawyer.name),
          journey_id: journeyId || "",
          lawyer_name: lawyer.name || "",
          lawyer_meta: [lawyer.specialisation, lawyer.city].filter(Boolean).join(" · "),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Could not create the chat room");

      const ws = new WebSocket(
        `${websocketBaseUrl()}/ws/lawyer/user/${data.room_id}?user_id=${encodeURIComponent(userId || "")}`
      );
      wsRef.current = ws;
      ws.onmessage = (event) => {
        let evt = {};
        try {
          evt = JSON.parse(event.data);
        } catch {
          return;
        }
        if (evt.type === "connected") {
          setStatus("live");
          setChat([{ sender: "system", text: evt.message || "Connected." }]);
        } else if (evt.type === "message") {
          setChat((prev) => [...prev, { sender: "lawyer", text: evt.text, simulated: !!evt.simulated }]);
        } else if (evt.type === "session_ended") {
          setStatus("closed");
          setChat((prev) => [...prev, { sender: "system", text: "Chat session ended." }]);
        } else if (evt.type === "error") {
          setWsError(evt.detail || "Chat connection error");
        }
      };
      ws.onerror = () => {
        setStatus("error");
        setWsError(
          "Could not open the live chat connection. WebSocket support requires the backend to run on a WebSocket-capable host (e.g. locally via uvicorn)."
        );
      };
      ws.onclose = () => {
        setStatus((prev) => (prev === "connecting" || prev === "live" ? "error" : prev));
      };
    } catch (err) {
      setStatus("error");
      setWsError(err.message);
    }
  }

  function sendMsg(event) {
    event?.preventDefault();
    const text = draft.trim();
    const ws = wsRef.current;
    if (!text || !ws || ws.readyState !== WebSocket.OPEN || status !== "live") return;
    ws.send(JSON.stringify({ type: "message", text }));
    setChat((prev) => [...prev, { sender: "user", text }]);
    setDraft("");
  }

  function endSession() {
    try {
      wsRef.current?.send(JSON.stringify({ type: "end_session" }));
    } catch {
      /* socket already gone */
    }
  }

  const statusPill = {
    idle: null,
    connecting: (
      <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400 animate-pulse">
        ● Connecting…
      </span>
    ),
    live: (
      <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
        ● Live
      </span>
    ),
    closed: <span className={CHIP}>Session ended</span>,
    error: (
      <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-medium text-danger">
        ✕ Disconnected
      </span>
    ),
  }[status];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-app p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-elev shadow-2xl animate-rise"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-xl shadow-lg shadow-emerald-500/25">
            💬
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="m-0 text-base font-bold">Live Chat with Lawyer</h3>
            <p className="m-0 text-xs text-muted">
              WebSocket real-time chat · demo replies until a real lawyer joins
            </p>
          </div>
          {statusPill}
          <button type="button" className={BTN_GHOST} onClick={onClose}>
            ✕
          </button>
        </div>

        {!selected ? (
          <div className="flex-1 space-y-2 overflow-auto px-5 py-4">
            {lawyers === null && !loadError && (
              <p className="text-sm text-muted animate-pulse">Loading lawyer directory from Neon Postgres…</p>
            )}
            {loadError && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-danger">{loadError}</p>
            )}
            {lawyers?.length === 0 && <p className="text-sm text-muted">No lawyers in the directory yet.</p>}
            {(lawyers || []).map((lawyer) => (
              <article
                key={lawyer.id ?? lawyer.bar_council_id}
                className="rounded-xl border border-line bg-app p-3 transition-transform hover:-translate-y-0.5 hover:shadow-lg"
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="text-sm">{lawyer.name}</strong>
                  {lawyer.available_for_chat ? (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      ● Available for chat
                    </span>
                  ) : (
                    <span className={CHIP}>Chat unavailable</span>
                  )}
                </header>
                <p className="mb-1.5 mt-1 flex flex-wrap gap-1">
                  <span className={CHIP}>{lawyer.specialisation}</span>
                  <span className={CHIP}>{lawyer.city}, {lawyer.state}</span>
                  <span className={CHIP}>{lawyer.experience_years} yrs</span>
                  <span className={CHIP}>★ {lawyer.rating}/5 ({lawyer.reviews_count})</span>
                  <span className={CHIP}>₹{lawyer.fees_per_hearing}/hearing</span>
                </p>
                <p className="m-0 mb-2 line-clamp-2 text-xs text-muted">{lawyer.profile}</p>
                <button
                  type="button"
                  className={`${BTN_GRADIENT} px-4 py-1.5 text-sm`}
                  disabled={!lawyer.available_for_chat}
                  onClick={() => startChat(lawyer)}
                >
                  💬 Start live chat
                </button>
              </article>
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-2.5 text-sm">
              <span className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-bold text-white">
                {(selected.name || "L").replace(/^Adv\.?\s*/i, "").slice(0, 1)}
              </span>
              <strong>{selected.name}</strong>
              <span className={CHIP}>{selected.specialisation}</span>
              <span className={CHIP}>{selected.city}</span>
              <button
                type="button"
                className="ml-auto cursor-pointer text-xs text-muted transition-colors hover:text-ink"
                onClick={() => {
                  try {
                    wsRef.current?.close();
                  } catch {
                    /* noop */
                  }
                  setSelected(null);
                  setStatus("idle");
                  setChat([]);
                  setWsError("");
                }}
              >
                ← Change lawyer
              </button>
            </div>
            <div className="h-80 flex-1 space-y-2.5 overflow-auto bg-app px-5 py-4">
              {status === "connecting" && (
                <p className="text-center text-sm text-muted animate-pulse">Opening WebSocket room…</p>
              )}
              {wsError && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-danger">{wsError}</p>
              )}
              {chat.map((m, idx) =>
                m.sender === "system" ? (
                  <p key={idx} className="m-0 text-center text-[11px] italic text-faint">
                    {m.text}
                  </p>
                ) : (
                  <div key={idx} className={`flex items-end gap-2 animate-rise ${m.sender === "user" ? "justify-end" : ""}`}>
                    {m.sender === "lawyer" && (
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-bold text-white">
                        {(selected.name || "L").replace(/^Adv\.?\s*/i, "").slice(0, 1)}
                      </span>
                    )}
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                        m.sender === "user"
                          ? "rounded-br-sm bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow"
                          : "rounded-bl-sm border border-line bg-elev text-ink"
                      }`}
                    >
                      {m.text}
                      {m.simulated && (
                        <small className="mt-1 block text-[9px] uppercase tracking-wide opacity-60">simulated demo reply</small>
                      )}
                    </div>
                  </div>
                )
              )}
              <div ref={chatEndRef} />
            </div>
            <form className="flex items-center gap-2 border-t border-line px-5 py-3" onSubmit={sendMsg}>
              <input
                className={INPUT_FIELD.replace("mt-1 ", "")}
                placeholder={status === "live" ? `Message ${selected.name}…` : "Waiting for connection…"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={status !== "live"}
              />
              <button
                type="button"
                className="cursor-pointer rounded-lg border border-line px-3 py-2 text-xs text-muted transition-colors hover:bg-side-hover hover:text-danger"
                onClick={endSession}
                disabled={status !== "live"}
              >
                End session
              </button>
              <button className={`${BTN_GRADIENT} px-4 py-2 text-sm`} type="submit" disabled={status !== "live" || !draft.trim()}>
                Send
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function MemoryDetail({ token, journeyId, onBack, onOpenJourney }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const rawJson = JSON.stringify(data, null, 2);
  async function copyRaw() {
    try {
      await navigator.clipboard.writeText(rawJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }
  function downloadRaw() {
    const blob = new Blob([rawJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-memory-data.json";
    a.click();
    URL.revokeObjectURL(url);
  }

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
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-indigo-500/10 px-4 py-3 shadow-sm">
        <div>
          <p className="m-0 text-[11px] font-bold uppercase tracking-[0.16em] text-accent">Private workspace</p>
          <h2 className="m-0 text-xl font-bold">Memory</h2>
          <p className="m-0 text-xs text-muted">Your legal context, preferences, and document knowledge.</p>
        </div>
        <button type="button" className={BTN_GHOST} onClick={onBack}>
          Back
        </button>
      </div>
      <p className="text-xs text-faint">
        {data.journey_id ? data.journey_id.slice(0, 8) : "—"} · max 5 MB · {fileStore.bucket || "files"}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-elev/50 px-4 py-3">
        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={showRaw}
            onChange={(e) => setShowRaw(e.target.checked)}
          />
          <span className="relative h-5 w-9 shrink-0 rounded-full bg-line transition-colors after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:bg-emerald-500 peer-checked:after:translate-x-4" />
          <span>
            🔐 Share my complete memory data with me
            <small className="block text-[11px] text-faint">
              Memory is strictly yours — per user, per thread. Toggle on to view everything the app stores about you.
            </small>
          </span>
        </label>
        {showRaw && (
          <span className="flex gap-2">
            <button type="button" className={BTN_GHOST} onClick={copyRaw}>
              {copied ? "Copied ✓" : "Copy JSON"}
            </button>
            <button type="button" className={BTN_GHOST} onClick={downloadRaw}>
              Download
            </button>
          </span>
        )}
      </div>
      {showRaw && (
        <pre className="max-h-96 overflow-auto rounded-xl border border-line bg-app p-3 text-[11px] leading-relaxed text-muted">
          {rawJson}
        </pre>
      )}

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

/* ── Auth-screen marketing hero + dark-glass field style ── */
const AUTH_FIELD =
  "mt-1 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm text-white placeholder-emerald-100/40 outline-none transition-colors focus:border-emerald-400/70";

const EMPTY_SAMPLES = [
  "Draft a legal notice for unpaid salary",
  "Consumer complaint for a defective product",
  "Explain bail conditions under BNSS",
];

function MarketingHero() {
  return (
    <section className="hidden max-w-xl flex-col gap-6 lg:flex animate-rise lg:-translate-y-10">
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold tracking-widest text-emerald-300">
        ⚖️ AI LEGAL ASSISTANT
      </span>
      <h1 className="m-0 text-4xl font-black leading-tight text-white xl:text-5xl">
        Know the law.
        <br />
        <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-indigo-300 bg-clip-text text-transparent">
          Act with confidence.
        </span>
      </h1>
      <p className="m-0 text-sm leading-relaxed text-emerald-100/70 xl:text-base">
        Legal Assist pairs multi-agent AI research with human-in-the-loop approval — grounded answers, polished drafts, and a memory that belongs only to you.
      </p>
      <ul className="m-0 grid list-none gap-3 p-0 text-sm text-emerald-50/90">
        <li className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5">⚖️</span>
          Multi-agent research, drafting & case strategy
        </li>
        <li className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5">🧠</span>
          Personal memory — private per user, per thread
        </li>
        <li className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5">✅</span>
          Human approval before any draft is final
        </li>
        <li className="flex items-center gap-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5">🔍</span>
          Grounded in your documents & legal sources
        </li>
      </ul>
      <p className="m-0 text-[11px] text-emerald-100/40">AI guidance — not a substitute for a qualified lawyer.</p>
    </section>
  );
}

function AuthScreen({ onAuthed, onGuest, onAnonymous }) {
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

  async function anonymous() {
    setBusy(true);
    setError("");
    try {
      await onAnonymous();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="w-full max-w-md space-y-3 rounded-3xl border border-white/10 bg-[#06201a]/75 p-6 text-emerald-50 shadow-2xl shadow-black/50 backdrop-blur-xl animate-rise sm:p-7"
      onSubmit={submit}
    >
      <div className="flex items-center gap-2.5 pb-1 font-semibold text-white">
        <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 via-teal-500 to-indigo-600 text-sm font-bold text-white shadow-lg shadow-emerald-500/30">
          L
        </span>
        Legal Assist
      </div>
      <h1 className="text-xl font-bold text-white">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
      {mode === "register" && (
        <>
          <label className="block text-sm text-emerald-100/70">
            Name
            <input
              className={AUTH_FIELD}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </label>
          <label className="block text-sm text-emerald-100/70">
            Role
            <select className={AUTH_FIELD} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="user" className="text-slate-900">User</option>
              <option value="lawyer" className="text-slate-900">Lawyer</option>
            </select>
          </label>
        </>
      )}
      <label className="block text-sm text-emerald-100/70">
        Email
        <input
          className={AUTH_FIELD}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm text-emerald-100/70">
        Password
        <input
          className={AUTH_FIELD}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
      </label>
      {error && <p className="rounded-lg border border-red-400/40 bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p>}
      <button className={`${BTN_GRADIENT} w-full py-2.5`} type="submit" disabled={busy}>
        {busy ? "Please wait…" : mode === "login" ? "Continue" : "Create account"}
      </button>
      <button
        type="button"
        className="w-full cursor-pointer text-center text-sm text-emerald-100/60 transition-colors hover:text-white"
        onClick={() => setMode(mode === "login" ? "register" : "login")}
      >
        {mode === "login" ? "Need an account?" : "Have an account?"}
      </button>
      <div className="flex items-center gap-3 text-xs text-emerald-100/50 before:h-px before:flex-1 before:bg-white/15 after:h-px after:flex-1 after:bg-white/15">
        <span>or</span>
      </div>
      <button
        type="button"
        disabled={busy}
        className="flex w-full cursor-pointer flex-col items-center rounded-xl border border-emerald-400/40 bg-emerald-400/10 py-2.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={anonymous}
      >
        🙋 Continue as user — no login
        <small className="text-[11px] font-normal text-emerald-100/50">Full access (chat, uploads, memory, approvals) · No sign-up required</small>
      </button>
      <button
        type="button"
        className="flex w-full cursor-pointer flex-col items-center rounded-xl border border-white/15 py-2.5 text-sm text-emerald-50/90 transition-colors hover:bg-white/10"
        onClick={onGuest}
      >
        Continue as Guest
        <small className="text-[11px] text-emerald-100/50">Limited to 3 messages · No sign-up required</small>
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem("legal_assist_sidebar") === "collapsed");
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
  const [lawyerChatOpen, setLawyerChatOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("legal_assist_theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("legal_assist_sidebar", sidebarCollapsed ? "collapsed" : "expanded");
  }, [sidebarCollapsed]);

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

  async function startAnonymous() {
    // No-login full access: backend creates a role=user anonymous account.
    const res = await fetch(`${API}/auth/anonymous`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Could not start the anonymous session");
    localStorage.setItem("legal_assist_token", data.token);
    localStorage.setItem("legal_assist_role", data.user?.role || "user");
    localStorage.removeItem(GUEST_MODE_KEY);
    setGuestMode(false);
    onAuthed(data);
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

  // ── Shared SSE plumbing for /chat/stream/v2 and /chat/hitl/resume ──
  const patchLastAssistant = (patch) => {
    setMessages((current) => {
      const next = [...current];
      const last = next[next.length - 1];
      if (!last || last.role !== "assistant") return current;
      const applied = typeof patch === "function" ? patch(last) : patch;
      next[next.length - 1] = { ...last, ...applied };
      return next;
    });
  };

  function applyStreamEvent(evt, ctx) {
    if (evt.type === "thinking") {
      patchLastAssistant((prev) => ({
        trace: { ...(prev.trace || {}), thinking: evt.text },
      }));
      setPhase("analysing");
    } else if (evt.type === "flow") {
      patchLastAssistant((prev) => ({
        trace: { ...(prev.trace || {}), steps: evt.steps || [] },
      }));
    } else if (evt.type === "retrieval") {
      patchLastAssistant((prev) => ({
        trace: {
          ...(prev.trace || {}),
          retrieval: { report: evt.report, hits: evt.hits || [] },
        },
      }));
    } else if (evt.type === "cache") {
      patchLastAssistant((prev) => ({
        trace: { ...(prev.trace || {}), cache: evt.report },
      }));
    } else if (evt.type === "cache_write") {
      patchLastAssistant((prev) => ({
        trace: {
          ...(prev.trace || {}),
          cacheWrite: evt.report,
          cache: prev.trace?.cache || evt.report,
        },
      }));
    } else if (evt.type === "agent_route") {
      patchLastAssistant({
        routedTo: evt.routed_to || null,
        analysis: evt.analysis || null,
      });
      setPhase("writing");
    } else if (evt.type === "workflow") {
      patchLastAssistant((prev) => ({
        workflow: evt.workflow || null,
        trace: { ...(prev.trace || {}), workflow: evt.workflow || null },
      }));
    } else if (evt.type === "stage") {
      const stage = evt.stage || {};
      if (stage.stage_id) {
        patchLastAssistant((prev) => {
          const stages = [...((prev.trace && prev.trace.stages) || [])];
          const idx = stages.findIndex((s) => s.stage_id === stage.stage_id);
          if (idx >= 0) stages[idx] = { ...stages[idx], ...stage };
          else stages.push(stage);
          return { trace: { ...(prev.trace || {}), stages } };
        });
      }
    } else if (evt.type === "memory") {
      setMemory((prev) => ({ ...prev, layers: evt.layers || [], facts: evt.facts || [] }));
      patchLastAssistant((prev) => ({
        memoryLayers: evt.layers || [],
        trace: { ...(prev.trace || {}), memoryLayers: evt.layers || [] },
      }));
      if (evt.journey_id) setJourneyId(evt.journey_id);
    } else if (evt.type === "memory_write") {
      setMemory((prev) => ({ ...prev, writes: evt.writes || [] }));
      patchLastAssistant((prev) => ({
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
    } else if (evt.type === "sql") {
      patchLastAssistant({
        sqlInfo: {
          sql: evt.sql || "",
          rowCount: evt.row_count ?? 0,
          columns: evt.columns || [],
          tables: evt.tables || [],
        },
      });
    } else if (evt.type === "guardrail") {
      const guard = evt.guardrail || {};
      if (guard.name) {
        patchLastAssistant((prev) => ({
          guardrails: [...(prev.guardrails || []), guard],
        }));
      }
    } else if (evt.type === "hitl") {
      // Human-in-the-loop approval request → show the in-chat approval box.
      patchLastAssistant({
        hitl: {
          requestId: evt.request_id || "",
          stageId: evt.stage_id || "",
          question: evt.question || "Do you approve this draft?",
          draft: evt.draft || "",
          options: evt.options || [],
          status: "pending",
          decision: "",
          comment: "",
        },
      });
    } else if (evt.type === "analysis") {
      patchLastAssistant({ analysis: evt.analysis });
      setPhase("writing");
      if (evt.model) setModel(evt.model);
    } else if (evt.type === "token") {
      ctx.assembled += evt.content || "";
      patchLastAssistant({ content: ctx.assembled });
      setPhase("writing");
    } else if (evt.type === "done" && evt.model) {
      setModel(evt.model);
    } else if (evt.type === "error") {
      throw new Error(evt.detail || "Stream failed");
    }
  }

  async function consumeSseStream(res, ctx) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer = parseSseBuffer(buffer + decoder.decode(value, { stream: true }), (evt) =>
        applyStreamEvent(evt, ctx)
      );
    }
  }

  // Resume a paused HITL workflow with the human's decision (Claude-Code style).
  async function resumeHitl(decision, comment = "") {
    if (phase !== "idle") return;
    const last = messages[messages.length - 1];
    const hitl = last?.hitl;
    if (!hitl?.requestId || hitl.status === "decided") return;
    // Lock the card immediately so the decision cannot be sent twice.
    patchLastAssistant((prev) => ({ hitl: { ...prev.hitl, status: "decided", decision, comment } }));
    setPhase("writing");
    setError("");
    try {
      const res = await fetch(`${API}/chat/hitl/resume`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ request_id: hitl.requestId, decision, comment }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `Resume failed (${res.status})`);
      }
      // Continue streaming into the same assistant message.
      const ctx = { assembled: last?.content || "" };
      await consumeSseStream(res, ctx);
    } catch (err) {
      setError(err.message || "Could not resume the workflow");
      // Unlock the card so the human can try again.
      patchLastAssistant((prev) => ({ hitl: { ...prev.hitl, status: "pending" } }));
    } finally {
      setPhase("idle");
      inputRef.current?.focus();
    }
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
      const ctx = { assembled: "" };
      await consumeSseStream(res, ctx);
      if (!ctx.assembled.trim()) throw new Error("The assistant returned an empty response. The AI model may be unavailable — please try again in a moment.");
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
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#03120c] p-4 text-emerald-50 lg:p-8">
        {/* Marketing backdrop: ambient gradients + Lady Justice artwork */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1100px_620px_at_75%_-10%,rgba(16,185,129,0.20),transparent),radial-gradient(900px_520px_at_-10%_110%,rgba(99,102,241,0.16),transparent)]" />
        {/* Real statue artwork on the left, stylized gold emblem on the right */}
        <img
          src={ladyJusticePng}
          alt=""
          className="pointer-events-none absolute bottom-0 left-1/2 h-[72%] w-auto -translate-x-1/2 opacity-25 [mask-image:linear-gradient(to_top,black_82%,transparent)] lg:left-[4%] lg:h-[94%] lg:translate-x-0 lg:opacity-45"
        />
        <LadyJusticeArt className="pointer-events-none absolute bottom-0 right-[-40px] hidden h-[104%] w-auto lg:block lg:opacity-95" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#03120c] via-transparent to-[#03120c]/70" />
        <div className="relative z-10 grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_minmax(0,0.95fr)]">
          <MarketingHero />
          <AuthScreen onAuthed={onAuthed} onGuest={startGuest} onAnonymous={startAnonymous} />
        </div>
      </div>
    );
  }

  const busy = phase !== "idle" || !!uploadJob?.running;
  const hitlPending = messages.some((m) => m.hitl && m.hitl.status === "pending");
  const initial = (user?.name || user?.email || "U").slice(0, 1).toUpperCase();

  return (
    <div className={`relative grid h-screen overflow-hidden bg-app text-ink transition-[grid-template-columns] duration-300 ${sidebarCollapsed ? "md:grid-cols-[76px_minmax(0,1fr)]" : "md:grid-cols-[276px_minmax(0,1fr)]"}`}>
      <img src={ladyJusticePng} alt="" className="pointer-events-none absolute bottom-0 right-0 z-0 h-[48%] max-w-[68vw] select-none object-contain opacity-[0.09] [filter:sepia(0.5)_saturate(1.25)] dark:opacity-[0.16] md:h-[88%] md:max-w-[48vw]" />
      {sidebarOpen && <button type="button" className="fixed inset-0 z-10 bg-black/45 backdrop-blur-[1px] md:hidden" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside
        className={`relative z-20 flex-col overflow-hidden border-r border-line bg-side/95 px-2 pb-3 pt-2.5 backdrop-blur-xl ${
          sidebarOpen ? "fixed inset-y-0 left-0 z-20 flex w-72 max-w-[86vw] shadow-2xl" : "hidden"
        } md:static md:flex md:w-auto md:max-w-none md:shadow-none`}
      >
        <img src={ladyJusticePng} alt="" className={`pointer-events-none absolute bottom-12 right-[-38px] h-52 w-auto select-none opacity-[0.12] [filter:sepia(0.45)_saturate(1.25)] dark:opacity-[0.2] ${sidebarCollapsed ? "md:hidden" : ""}`} />
        <div className={`flex items-center px-2.5 pb-3.5 pt-2.5 font-semibold ${sidebarCollapsed ? "justify-center" : "gap-2.5"}`}>
          <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 via-teal-500 to-indigo-600 text-sm font-bold text-white shadow-md shadow-emerald-500/30">
            L
          </span>
          <span className={sidebarCollapsed ? "truncate md:hidden" : "truncate"}>Legal Assist</span>
          <button type="button" className={`${BTN_GHOST} ml-auto hidden size-8 place-items-center p-0 md:grid`} onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? "Expand sidebar" : "Minimize sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Minimize sidebar"}>
            <Icon name={sidebarCollapsed ? "expand" : "collapse"} />
          </button>
        </div>
        {guestMode ? (
          <div className={`mx-1 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm ${sidebarCollapsed ? "md:hidden" : ""}`}>
            <p className="m-0 font-semibold">Guest Mode</p>
            <small className="mt-1 block text-xs text-muted">
              Sign up for full access: memory, file uploads, and unlimited chats.
            </small>
          </div>
        ) : (
          <>
            <button
              type="button"
              className={`mb-1 flex w-full cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-side-hover ${view === "chat" ? "bg-side-hover font-medium text-ink" : ""}`}
              onClick={() => { setView("chat"); setSidebarOpen(false); }}
              title="Overview"
            >
              <Icon name="overview" className="shrink-0" /><span className={sidebarCollapsed ? "md:hidden" : ""}>Overview</span>
            </button>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110 active:scale-[0.98]"
              onClick={newJourney}
            >
              <Icon name="plus" className="size-[18px]" /><span className={sidebarCollapsed ? "md:hidden" : ""}>New chat</span>
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
              <span className="inline-flex items-center gap-2"><span>◈</span><span className={sidebarCollapsed ? "md:hidden" : ""}>Memory</span></span>
            </button>
          </>
        )}
        {!guestMode && (
          <>
            <div className={`items-center justify-between ${sidebarCollapsed ? "flex md:hidden" : "flex"}`}>
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
            <ul className={`m-0 flex-1 list-none overflow-auto p-0 sidebar-scroll ${sidebarCollapsed ? "md:hidden" : ""}`}>
              {journeys.map((item) => (
                <li
                  key={item.journey_id}
                  className={`mb-0.5 rounded-xl transition-colors hover:bg-side-hover ${
                    item.journey_id === journeyId
                      ? "border border-emerald-500/25 bg-gradient-to-r from-emerald-500/15 to-teal-500/5"
                      : ""
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
            <span className={`min-w-0 ${sidebarCollapsed ? "md:hidden" : ""}`}>
              <strong className="block truncate text-sm">{user?.name || "Account"}</strong>
              <small className="block truncate text-xs text-faint">{guestMode ? "Guest mode" : user?.email}</small>
            </span>
          </button>
        </div>
      </aside>

      <div className="relative z-10 flex h-screen min-w-0 flex-col">
        <header className="flex min-h-14 items-center gap-2 overflow-x-auto border-b border-line bg-app/80 px-3 py-2 backdrop-blur-xl sm:px-4">
          <button
            type="button"
            className={`${BTN_GHOST} md:hidden`}
            onClick={() => setSidebarOpen((v) => !v)}
          >
            <Icon name="menu" /><span>Menu</span>
          </button>
          <h1 className="m-0 max-w-44 shrink-0 truncate text-base font-semibold sm:max-w-xs">
            {guestMode
              ? "Guest Chat"
              : journeys.find((item) => item.journey_id === journeyId)?.title || "Legal Assist"}
          </h1>
          <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
            {guestMode && (
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                {guestCount}/3 messages
              </span>
            )}
            <button
              type="button"
              className={`${BTN_GHOST} inline-flex items-center gap-1.5 whitespace-nowrap ${showAgents ? "bg-accent/15 text-accent" : ""}`}
              onClick={() => setShowAgents((v) => !v)}
              title={showAgents ? "Hide registered agents list" : "Show registered agents list"}
            >
              <Icon name="agents" /><span>Agents {showAgents ? "Hide" : "Show"}</span>
            </button>
            <button type="button" className={`${BTN_GHOST} inline-flex items-center gap-1.5 whitespace-nowrap ${view === "guidebook" ? "bg-accent/15 text-accent" : ""}`} onClick={() => setView("guidebook")} title="Open sample queries, expected responses, and agent flows">
              <Icon name="guide" /><span>Agent Guide</span>
            </button>
            {!guestMode && (
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-2.5 py-1.5 text-[0px] font-medium text-white shadow shadow-emerald-500/20 transition hover:brightness-110 active:scale-[0.98]"
                onClick={() => setLawyerChatOpen(true)}
                title="Open real-time lawyer chat"
              >
                <Icon name="lawyer" className="size-[18px]" /><span className="text-sm">Lawyer Chat</span>
                💬 Lawyer Chat
              </button>
            )}
            <button
              type="button"
              className={`${BTN_GHOST} inline-flex items-center gap-1.5 whitespace-nowrap`}
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            >
              <Icon name={theme === "dark" ? "sun" : "moon"} /><span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
            <button type="button" className={`${BTN_GHOST} inline-flex items-center gap-1.5 whitespace-nowrap`} onClick={logout}>
              <Icon name="logout" /><span>{guestMode ? "Exit guest" : "Log out"}</span>
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
        ) : view === "guidebook" ? (
          <Guidebook
            onBack={() => setView("chat")}
            onUseQuery={(query) => {
              // Load the sample into the chat box only — the user decides
              // when to send it by pressing Enter.
              setView("chat");
              setInput(query);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
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
            <div className="relative min-h-0 flex-1">
              <img
                src={ladyJusticePng}
                alt=""
                className="pointer-events-none absolute bottom-0 right-2 hidden h-[78%] w-auto select-none opacity-[0.16] [filter:sepia(0.3)_saturate(1.35)] drop-shadow-[0_12px_32px_rgba(16,185,129,0.18)] dark:opacity-[0.22] md:block"
              />
              <main className="h-full overflow-auto bg-gradient-to-b from-emerald-500/[0.05] via-transparent to-indigo-500/[0.06]">
              <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6">
                {messages.length === 0 && (
                  <div className="flex flex-col items-center pt-12 text-center animate-fade">
                    <img
                      src={ladyJusticePng}
                      alt=""
                      className="pointer-events-none h-44 w-auto select-none [mask-image:linear-gradient(to_top,black_70%,transparent)]"
                    />
                    <h2 className="m-0 -mt-8 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 bg-clip-text text-3xl font-black text-transparent">
                      {guestMode ? "Guest Mode" : "What can I help with?"}
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                      {guestMode
                        ? `Ask up to 3 legal questions. Sign up for unlimited access.`
                        : "Ask a legal question. Memory stays on this journey."}
                    </p>
                    <div className="mt-5 flex max-w-xl flex-wrap justify-center gap-2">
                      {EMPTY_SAMPLES.map((q) => (
                        <button
                          key={q}
                          type="button"
                          className="cursor-pointer rounded-full border border-line bg-elev/70 px-3.5 py-1.5 text-sm text-muted transition hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-ink active:scale-95"
                          onClick={() => {
                            setInput(q);
                            inputRef.current?.focus();
                          }}
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((msg, i) => (
                  <div
                    key={`${msg.role}-${i}`}
                    className={`flex animate-rise ${msg.role === "user" ? "justify-end" : "gap-2.5"}`}
                  >
                    {msg.role === "assistant" && (
                      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-emerald-500 via-teal-500 to-indigo-600 text-xs font-bold text-white shadow ring-2 ring-emerald-500/25">
                        L
                      </span>
                    )}
                    <div
                      className={`min-w-0 max-w-[min(680px,100%)] ${
                        msg.role === "user"
                          ? "rounded-3xl rounded-br-md bg-gradient-to-br from-emerald-500 to-teal-600 px-4 py-2.5 text-white shadow-lg shadow-emerald-500/20"
                          : "flex-1 pt-0.5"
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
                      {msg.role === "assistant" && msg.sqlInfo && <SqlCard sqlInfo={msg.sqlInfo} />}
                      {msg.role === "assistant" && <GuardrailCard guardrails={msg.guardrails} />}
                      {msg.role === "assistant" && msg.hitl && (
                        <ApprovalCard hitl={msg.hitl} busy={phase !== "idle"} onDecide={resumeHitl} />
                      )}
                      <div className={`m-0 text-[15px] ${msg.role === "assistant" ? "rounded-2xl rounded-tl-md border border-emerald-500/15 bg-elev/80 px-4 py-3 shadow-md shadow-emerald-500/5 backdrop-blur-sm" : ""}`}>
                        {msg.content ? (
                          msg.role === "assistant" ? (
                            <div className="leading-normal">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>{msg.content}</ReactMarkdown>
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
                      {msg.role === "assistant" && msg.content && msg.routedTo === "lawyer_finder" && !guestMode && (
                        <div className="mt-2">
                          <button
                            type="button"
                            className={`${BTN_GRADIENT} px-4 py-1.5 text-sm`}
                            onClick={() => setLawyerChatOpen(true)}
                          >
                            💬 Live Chat with Lawyer
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
                {phase === "writing" && (
                  <div className="flex items-center gap-1.5 pl-10 text-sm text-muted">
                    <span className="size-1.5 animate-bounce rounded-full bg-emerald-500" />
                    <span className="size-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:120ms]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:240ms]" />
                  </div>
                )}
                {error && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-danger">
                    {error}
                  </p>
                )}
                {!!followups.length && phase === "idle" && !hitlPending && (
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
            </div>
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
                className="flex items-end gap-2 rounded-2xl border border-line bg-elev p-2 shadow-lg shadow-black/10 transition focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/25"
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
                    className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-transparent text-[0px] text-muted transition-colors hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!!uploadJob?.running || !journeyId}
                    onClick={() => fileRef.current?.click()}
                    aria-label="Upload PDF, Word, text, or image"
                  >
                    <Icon name="upload" className="text-lg" />
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
                  className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-[0px] text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                  type="submit"
                  disabled={busy || !input.trim()}
                  aria-label="Send"
                >
                  <Icon name="send" className="ml-[-1px] text-lg" />
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

      {/* ── Lawyer Live Chat Modal ── */}
      {lawyerChatOpen && !guestMode && (
        <LawyerChatModal
          token={token}
          userId={user?.user_id || ""}
          journeyId={journeyId}
          onClose={() => setLawyerChatOpen(false)}
        />
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
