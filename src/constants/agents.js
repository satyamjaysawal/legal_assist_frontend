export const STEP_LABELS = {
  memory: "Memory load", rag: "Document search (RAG)", prompt_cache: "Prompt cache",
  analyser: "Query analyser", generate: "Answer generator", title: "Auto title",
  followups: "Follow-up generator", orchestrator: "Root agent (Orchestrator)",
  assistant: "Assistant agent", researcher: "Researcher agent", draft: "Draft agent",
  document_creator: "Document agent", email: "Email agent", lawyer_finder: "Lawyer finder",
  db_chat: "Lawyer database (SQL)", case_strategy: "Case strategy agent",
  compliance: "Compliance agent", workflow_supervisor: "Workflow supervisor",
  compress: "Context compression", fast_path: "Greeting fast-path",
  memory_write: "Memory save", cache_exact: "Exact-match cache", cache_semantic: "Semantic cache",
  cache_write: "Cache save",
};

export const AGENT_LABELS = {
  assistant: "Assistant", researcher: "Researcher", draft: "Draft",
  document_creator: "Document Creator", email: "Email", lawyer_finder: "Lawyer Finder", db_chat: "DB Chat",
  case_strategy: "Case Strategy", compliance: "Compliance", workflow_supervisor: "Workflow Supervisor",
};

export const UPLOAD_STEP_LABELS = {
  receive: "Receive file", validate: "Validate size", parse: "Parse document", chunk: "Chunk text",
  mongodb: "MongoDB upload", embed: "Embed chunks", qdrant: "Qdrant index",
};

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const GUEST_MODE_KEY = "legal_assist_guest";
