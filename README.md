# Legal Assist — Frontend

React + Tailwind chat UI for the **Legal AI Assistant** — streams the full multi-agent pipeline (LangGraph + Groq) with live memory, cache, RAG, SQL, and lawyer-chat visibility.

| Layer | Stack |
| --- | --- |
| **Frontend** | Vite + React + Tailwind CSS |
| **Backend** | FastAPI + LangChain + LangGraph + Groq ([separate repo](https://github.com/satyamjaysawal/legal_assist_backend)) |

## Live production (Vercel)

| Service | URL |
| --- | --- |
| **Frontend app** | https://legal-assist-compact.vercel.app |
| **Backend API** | https://legal-assist-api.vercel.app |
| **Backend health** | https://legal-assist-api.vercel.app/health |
| **Swagger docs** | https://legal-assist-api.vercel.app/docs |

**GitHub:** https://github.com/satyamjaysawal/legal_assist_frontend
**Vercel project:** `legal-assist` under [satyam-jaysawals-projects](https://vercel.com/satyam-jaysawals-projects)

## Features

- Streams `POST /chat/stream/v2` (SSE) token-by-token
- **Agent Pipeline panel** — live step timeline: memory reads/writes, exact & semantic cache, RAG, orchestrator routing, specialist agent, follow-ups, cache save
- **Intent chips** — intent · domain · complexity · routed agent
- **🗄 Executed SQL card** — full SQL + row count + tables + columns for database answers (`sql` SSE event)
- **💬 Lawyer Chat** — header button + inline button on lawyer-finder replies; opens the Neon lawyer directory, creates a WebSocket room, and chats in real time (simulated lawyer replies in demo mode)
- **HITL Draft-Fill wizard** — guided field filling before downloading or emailing drafts
- **Download / Send Email** actions (PDF · DOCX · TXT) for draft, document, and email replies
- Markdown rendering with tables · follow-up suggestion chips · auto titles
- File uploads (PDF/DOCX/text/images, 5 MB) with a live upload pipeline panel
- Memory viewer (profile, stores, episodes, preferences, facts, files) · Profile page
- Journeys sidebar — multiple chats, rename, delete · guest mode (3 messages)
- Dark/light theme · Tailwind-only styling

## File structure

```
legal_assist_frontend/
├── index.html
├── package.json
├── vite.config.js      # local proxy → http://127.0.0.1:8000 (incl. /ws websocket)
├── vercel.json
└── src/
    ├── main.jsx
    ├── App.jsx         # whole app: chat, pipeline, wizard, lawyer chat, memory
    ├── App.css
    └── index.css       # Tailwind theme tokens
```

## Environment variables

Production needs the backend URL (baked in at build time):

| Variable | Value | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `https://legal-assist-api.vercel.app` | FastAPI base URL |

Locally you can leave it empty — Vite proxies `/chat`, `/auth`, `/journeys`, `/memory`, `/documents`, `/connectors`, `/lawyer`, `/lawyers`, `/admin` and the `/ws` WebSocket to `http://127.0.0.1:8000`.

## Local setup

**Prerequisites:** Node 18+, backend running on port 8000.

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:5173 — start the backend first:

```powershell
cd ../legal_assist_backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

## Deploy on Vercel

```powershell
vercel link --yes
vercel env add VITE_API_URL production --value "https://legal-assist-api.vercel.app" --sensitive
vercel --prod --yes
```

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Badge stays `connecting…` | Backend is down, or `VITE_API_URL` is missing / wrong |
| CORS error in the browser | Confirm backend allows this origin (`*.vercel.app` or `CORS_ORIGINS`) |
| Chat works locally but not on Vercel | Rebuild after setting `VITE_API_URL` (Vite inlines it at build time) |
| Lawyer chat says connection unavailable | WebSocket needs a WS-capable backend host — run the backend locally with uvicorn |
