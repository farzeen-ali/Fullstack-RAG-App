# DocuMind AI — Intelligent Enterprise & Study Knowledge Base

Upload PDFs, study guides or company policies, then chat with them. Answers are grounded in **your** documents via **local ChromaDB** vector search, streamed token-by-token, with clickable **source citation chips** (document + page + excerpt + similarity %).

```
┌──────────────────────────────┐   SSE (status/token/done)   ┌────────────────────────────────────────────┐
│  frontend/  Expo Router      │ ◀──────────────────────────▶│  backend/  NestJS                           │
│  NativeWind · Reanimated      │   POST /rag/upload          │  Zero-token router → guard → cache           │
│  keyboard-controller          │   GET/DELETE /rag/documents │  → OpenAI embed → Chroma query (nResults=4) │
└──────────────────────────────┘                               │  → gpt-4o-mini (XML-hardened stream)         │
                                                               └──────────────┬─────────────────────────────┘
                                                                              │ HTTP :8000
                                    ┌─────────────────────────────────────────┴──────────────────────────┐
                                    │  ChromaDB (cosine, collection documind_rag)  +  backend/data/ JSON  │
                                    └────────────────────────────────────────────────────────────────────┘
```

---

## Contents

1. [Features](#1-features)
2. [ChromaDB setup & run guide](#2-chromadb-setup--run-guide)
3. [Migrate from Pinecone](#3-migrate-from-pinecone)
4. [Installation](#4-installation)
5. [Environment variables](#5-environment-variables)
6. [Running on phone (Expo Go)](#6-running-on-phone-expo-go)
7. [API reference](#7-api-reference)
8. [Cost & security](#8-cost--security)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Features

| Area | What you get |
| --- | --- |
| **Vectors** | `chromadb` JS client — upsert on ingest, metadata filter on query/delete, collection `documind_rag` (configurable). |
| **Registry** | Document metadata (status, chunk counts, names) in `backend/data/documents.json` (git-ignored). |
| **Ingestion** | PDF / `.txt` / `.md` ≤ 10 MB → ~600-char chunks (100 overlap) → `text-embedding-3-small` → batched Chroma upsert. |
| **Retrieval** | `nResults = 4`, cosine similarity `> RAG_SIMILARITY_THRESHOLD` (default **0.72**), optional `documentIds` scope. |
| **Cost** | Zero-token greetings, query cache, no-match short-circuit, throttling. |
| **Security** | Prompt injection guard, XML-delimited context, output canary, Helmet, DTO bounds. |
| **Mobile UI** | Glass surfaces, **ChromaDB Local • Active** pill, emerald search pulse, match % on source chips, Reanimated streams + source sheet. |

**Metadata on each Chroma record**

| Field | Purpose |
| --- | --- |
| `documentId` | Filter deletes & scoped search |
| `documentName` | Citations |
| `pageNumber` | Citations |
| `chunkIndex` | Stable ID suffix |
| `textSnippet` | RAG context + source sheet |

Record IDs: `{documentId}:{chunkIndex}`.

---

## 2. ChromaDB setup & run guide

### Step 1 — Install ChromaDB (Python)

Pick any one package manager:

```bash
# pip (most common)
pip install chromadb

# poetry
poetry add chromadb

# uv
uv pip install chromadb
```

Requires **Python 3.9+**. Use a virtual environment if you already use one for other tools.

### Step 2 — Start the persistent local server

From your project root (or any folder where you want storage):

```bash
chroma run --path ./chroma_data --port 8000
```

Keep this terminal open. Chroma persists vectors under `./chroma_data` between restarts.

**Verify it is running**

1. You should see a log line that the server is listening on port **8000**.
2. Optional quick Python check:

```python
import chromadb

client = chromadb.HttpClient(host="localhost", port=8000)
print(client.heartbeat())  # e.g. a nanosecond timestamp integer
print(client.list_collections())
```

### Step 3 — Connect the NestJS backend

```bash
cd backend
npm uninstall @pinecone-database/pinecone
npm install chromadb
cp .env.example .env
```

In `backend/.env` set at minimum:

- `OPENAI_API_KEY`
- `CHROMA_URL=http://localhost:8000`
- `CHROMA_COLLECTION_NAME=documind_rag`

Start the API:

```bash
npm run start:dev
```

On startup you should see: `ChromaDB connected at http://localhost:8000 — collection "documind_rag"`.

The backend calls `getOrCreateCollection` with **`hnsw:space: cosine`** (collection metadata + HNSW config) so distances map to OpenAI cosine similarity as `similarity = 1 - distance`.

---

## 3. Migrate from Pinecone

1. **Stop** using Pinecone env vars — remove `PINECONE_*` from `backend/.env`.
2. Run the [backend package commands](#step-3--connect-the-nestjs-backend) above.
3. Start Chroma ([Step 2](#step-2--start-the-persistent-local-server)).
4. **Re-upload PDFs** — vectors are not migrated automatically; only the local JSON registry remains.

---

## 4. Installation

### Backend

```bash
cd backend
npm install
```

Core vector dependency:

```bash
npm install chromadb openai pdf-parse helmet @nestjs/config @nestjs/throttler
npm install -D @types/multer
```

### Frontend

```bash
cd frontend
npm install
npx expo install nativewind@4.2.7 react-native-reanimated react-native-safe-area-context \
  react-native-keyboard-controller expo-document-picker expo-haptics \
  @expo/vector-icons expo-blur expo-linear-gradient
npx expo install tailwindcss@^3.4.17 --dev
```

Works with **Expo Go** (SDK 58).

---

## 5. Environment variables

### `backend/.env.example` → `backend/.env`

```dotenv
HOST=0.0.0.0
PORT=3000
CORS_ORIGINS=http://localhost:8081
DATA_DIR=./data

OPENAI_API_KEY=sk-proj-your-openai-key

CHROMA_URL=http://localhost:8000
CHROMA_COLLECTION_NAME=documind_rag

RAG_MATCH_COUNT=4
RAG_SIMILARITY_THRESHOLD=0.72
RAG_MAX_COMPLETION_TOKENS=600
RAG_MAX_CHUNKS_PER_DOCUMENT=1500

CACHE_TTL_SECONDS=3600
CACHE_MAX_ENTRIES=500

THROTTLE_TTL_MS=60000
THROTTLE_LIMIT=15
```

### `frontend/.env.example` → `frontend/.env`

```dotenv
EXPO_PUBLIC_BACKEND_URL=http://192.168.1.50:3000
```

Use your PC’s **LAN IP**, not `localhost`, on a physical phone. Never put OpenAI keys in the frontend.

---

## 6. Running on phone (Expo Go)

Use **three terminals**:

| Terminal | Command | Purpose |
| --- | --- | --- |
| **A** | `chroma run --path ./chroma_data --port 8000` | Vector database |
| **B** | `cd backend && npm run start:dev` | NestJS (`HOST=0.0.0.0`) |
| **C** | `cd frontend && npx expo start --clear` | Expo Go |

**Phone checklist**

1. Phone and PC on the **same Wi‑Fi**.
2. `frontend/.env`: `EXPO_PUBLIC_BACKEND_URL=http://<your-pc-lan-ip>:3000`
3. `backend/.env`: `CORS_ORIGINS` includes your Expo origin if needed.
4. Allow **port 3000** through Windows Firewall (Private network).
5. Knowledge Base → upload PDF → wait for **Ready**.
6. Header: **ChromaDB Local · Active · N docs · M chunks**.
7. Ask a question → emerald **Querying ChromaDB…** pulse → streamed answer + chips with **match %**.
8. `thanks!` → zero-token reply, no OpenAI/Chroma calls.

**Tests**

```bash
cd backend && npm test && npm run test:e2e
cd ../frontend && npx tsc --noEmit && npx expo lint
```

---

## 7. API reference

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `POST` | `/rag/upload` | Multipart `file`, max 10 MB |
| `GET` | `/rag/documents` | Registry from `data/documents.json` |
| `DELETE` | `/rag/documents/:id` | Registry + Chroma delete (`where: { documentId }`) |
| `POST` | `/rag/chat` | SSE: `status` → `token` → `done` with `sources[]` |

---

## 8. Cost & security

- **Layers:** intent router (0 calls) → prompt guard → LRU cache → embed + Chroma → `gpt-4o-mini`.
- **Models:** `text-embedding-3-small`, `gpt-4o-mini`.
- **OWASP LLM:** injection patterns stripped/blocked, `<retrieved_context>` untrusted, output canary, 15 req/min/IP.

---

## 9. Troubleshooting

| Issue | Fix |
| --- | --- |
| Server won’t start / invalid env | Set `OPENAI_API_KEY` and `CHROMA_URL`. Remove leftover `PINECONE_*` or `SUPABASE_*` vars. |
| `Vector knowledge base is unavailable` | Chroma not running, wrong port, or firewall blocking localhost:8000 from the backend process. |
| Always “couldn’t find” | Lower `RAG_SIMILARITY_THRESHOLD` (e.g. `0.55`); backend logs closest score when nothing passes. |
| Phone can’t reach API | Use LAN IP in `EXPO_PUBLIC_BACKEND_URL`; `HOST=0.0.0.0` on backend. |
| Empty list after migration | Re-upload; registry is local JSON under `DATA_DIR`. |

**Production:** run Chroma on a managed host or dedicated VM; add auth and per-user metadata filters; use Redis for cache/throttle when scaling the API horizontally.