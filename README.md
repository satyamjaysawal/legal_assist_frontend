# Legal Assist — Frontend

React chat UI for the Legal Assist backend (LangGraph + Groq streaming).

| Layer | Stack |
| --- | --- |
| **Frontend** | Vite + React |
| **Backend** | FastAPI + LangChain + LangGraph + Groq ([separate repo](https://github.com/satyamjaysawal/legal_assist_backend)) |

## Live production (Vercel)

| Service | URL |
| --- | --- |
| **Frontend** | https://legalassistfrontend.vercel.app |
| **Backend API** | https://legal-assist-graph.vercel.app |
| **Backend health** | https://legal-assist-graph.vercel.app/health |

**GitHub:** https://github.com/satyamjaysawal/legal_assist_frontend  
**Vercel project:** `legal_assist_frontend` under [satyam-jaysawals-projects](https://vercel.com/satyam-jaysawals-projects)

## Features

- Streams `POST /chat/stream` (SSE)
- Shows query-analyser chips (intent, domain, complexity)
- Enter to send, Shift+Enter for a new line
- Shows the live Groq model name

## File structure

```
legal_assist_frontend/
├── index.html
├── package.json
├── vite.config.js      # local proxy → http://127.0.0.1:8000
├── vercel.json
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── App.css
    └── index.css
```

## Environment variables

Production needs the backend URL (baked in at build time):

| Variable | Example | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | `https://legal-assist-graph.vercel.app` | FastAPI base URL |

Locally you can leave it empty. Vite proxies `/chat` and `/health` to `http://127.0.0.1:8000`.

## Local setup

**Prerequisites:** Node 18+, backend running on port 8000.

```powershell
npm install
npm run dev
```

Open http://127.0.0.1:5173

Start the backend first:

```powershell
cd ../legal_assist_backend
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

## Deploy on Vercel

1. Create/link project **`legal_assist_frontend`**.
2. Set `VITE_API_URL` to the live backend.
3. Deploy:

```powershell
npm i -g vercel
vercel link --yes --project legal_assist_frontend
vercel env add VITE_API_URL production --value "https://legal-assist-graph.vercel.app" --yes
vercel deploy --prod
```

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Badge stays `connecting…` | Backend is down, or `VITE_API_URL` is missing / wrong |
| CORS error in the browser | Confirm backend allows this origin (`*.vercel.app` or `CORS_ORIGINS`) |
| Chat works locally but not on Vercel | Rebuild after setting `VITE_API_URL` (Vite inlines it at build time) |
