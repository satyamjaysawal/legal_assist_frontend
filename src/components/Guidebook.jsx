const WORKFLOWS = [
  {
    title: "Sequential agents",
    prompt: "workflow: sequential Research tenant eviction rights in India, draft a response notice, then list next steps.",
    expected: "Research is handed to drafting, then a final action checklist is produced.",
    flow: "Orchestrator -> Researcher -> Draft -> Assistant",
  },
  {
    title: "Parallel agents",
    prompt: "workflow: parallel Review a proposed employment termination and prepare a protective reply.",
    expected: "Independent research and drafting run together; both outputs are shown.",
    flow: "Orchestrator -> Researcher || Draft",
  },
  {
    title: "Supervisor to subagents",
    prompt: "workflow: supervisor Prepare a consumer complaint package for a defective product.",
    expected: "A supervisor delegates research, document fields, and a customer email to specialist subagents.",
    flow: "Supervisor -> (Researcher, Document Creator, Email)",
  },
  {
    title: "Refinement loop",
    prompt: "workflow: loop Draft a landlord notice, review it for legal gaps, and refine it twice.",
    expected: "Draft-review-revise repeats with a fixed two-pass safety limit.",
    flow: "Draft -> Researcher review -> Draft revision x2",
  },
  {
    title: "Cyclic review",
    prompt: "workflow: cycle Research a service-agreement dispute, draft a notice, gap-check it, and revise it.",
    expected: "Research and drafting cycle once through a bounded gap-check before the final draft.",
    flow: "Researcher -> Draft -> Researcher -> Draft",
  },
];

const STANDARD_USE_CASES = [
  {
    title: "Document review",
    prompt: "Review this uploaded rental agreement and flag unfair clauses.",
    expected: "Issues, relevant law, risk notes, and a practical conclusion.",
    flow: "Orchestrator -> Researcher (RAG)",
  },
  {
    title: "Find a lawyer",
    prompt: "Show criminal lawyers in Mumbai with 10+ years experience.",
    expected: "Matching directory listings plus the Lawyer Chat option.",
    flow: "Orchestrator -> DB Chat / Lawyer Finder",
  },
  {
    title: "Legal email",
    prompt: "Write a professional email requesting a refund for a defective product.",
    expected: "A ready-to-send subject and body that can be exported or emailed.",
    flow: "Orchestrator -> Email",
  },
  {
    title: "Case strategy",
    prompt: "Create a case strategy for recovering my security deposit from a landlord in Delhi.",
    expected: "Objectives, missing facts, evidence checklist, options, deadlines, and risks.",
    flow: "Orchestrator -> Case Strategy",
  },
  {
    title: "Compliance check",
    prompt: "Check our employee onboarding process for Indian data privacy compliance gaps.",
    expected: "Assumptions, risk rating, control checklist, owners, and questions for counsel.",
    flow: "Orchestrator -> Compliance",
  },
];

export function Guidebook({ onUseQuery, onBack }) {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 overflow-auto p-4 sm:p-6 animate-fade">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="m-0 text-xs font-bold uppercase tracking-widest text-accent">Legal Assist POC</p>
          <h2 className="mb-1 mt-1 text-2xl font-bold">Agent guidebook</h2>
          <p className="m-0 max-w-3xl text-sm text-muted">Run a sample to observe the live pipeline. This demo uses bounded workflows so parallel work and iterative cycles remain predictable.</p>
        </div>
        <button type="button" className="cursor-pointer rounded-lg border border-line px-3 py-2 text-sm text-muted hover:bg-side-hover" onClick={onBack}>Back to chat</button>
      </header>

      <section>
        <h3 className="mb-2 text-lg font-semibold">Workflow patterns</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {WORKFLOWS.map((item) => (
            <article key={item.title} className="rounded-2xl border border-line bg-elev/50 p-4">
              <h4 className="m-0 text-base font-semibold">{item.title}</h4>
              <p className="mb-2 mt-1 text-xs text-accent">{item.flow}</p>
              <p className="mb-3 text-sm text-muted">Expected: {item.expected}</p>
              <code className="block rounded-lg bg-app p-2 text-xs text-ink">{item.prompt}</code>
              <button type="button" className="mt-3 cursor-pointer rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-sm font-semibold text-white" onClick={() => onUseQuery(item.prompt)}>Use sample</button>
            </article>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-lg font-semibold">Everyday legal use cases</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {STANDARD_USE_CASES.map((item) => (
            <article key={item.title} className="flex flex-col rounded-2xl border border-line bg-elev/50 p-4">
              <h4 className="m-0 font-semibold">{item.title}</h4>
              <p className="mb-1 mt-2 text-xs text-accent">{item.flow}</p>
              <p className="mt-1 text-sm text-muted">Expected: {item.expected}</p>
              <button type="button" className="mt-auto cursor-pointer text-left text-sm font-medium text-accent underline" onClick={() => onUseQuery(item.prompt)}>Try: {item.prompt}</button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
