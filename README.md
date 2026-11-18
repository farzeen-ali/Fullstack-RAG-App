# DocuMind AI — Intelligent Enterprise & Study Knowledge Base

Upload PDFs, study guides or company policies, then chat with them. Answers are grounded in **your** documents via **Pinecone** vector search, streamed token-by-token, with clickable **source citation chips** (document + page + excerpt + similarity).

```
┌──────────────────────────────┐   SSE (status/token/done)   ┌────────────────────────────────────────────┐
│  frontend/  Expo Router      │ ◀──────────────────────────▶│  backend/  NestJS                           │
│  NativeWind · Reanimated      │   POST /rag/upload          │  Zero-token router → guard → cache           │
│  keyboard-controller          │   GET/DELETE /rag/documents │  → OpenAI embed → Pinecone query (topK=4)    │
└──────────────────────────────┘                               │  → gpt-4o-mini (XML-hardened stream)         │
                                                               └──────────────┬─────────────────────────────┘
                                                                              │
                                    ┌─────────────────────────────────────────┴──────────────────────────┐
                                    │  Pinecone Serverless (1536 dims, cosine)  +  backend/data/ JSON     │
                                    │  vectors + metadata                        document registry       │
                                    └────────────────────────────────────────────────────────────────────┘
```

---

## Contents

1. [Features](#1-features)
2. [Pinecone setup](#2-pinecone-setup)
3. [Migrate from Supabase](#3-migrate-from-supabase)
4. [Installation](#4-installation)
5. [Environment variables](#5-environment-variables)
6. [Running & testing](#6-running--testing)
7. [API reference](#7-api-reference)
8. [Cost & security (unchanged)](#8-cost--security-unchanged)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Features

| Area | What you get |
| --- | --- |
| **Vectors** | `@pinecone-database/pinecone` — upsert on ingest, metadata filter on query/delete, namespace `documind` (configurable). |
| **Registry** | Document metadata (status, chunk counts, names) in `backend/data/documents.json` (git-ignored). |
| **Ingestion** | PDF / `.txt` / `.md` ≤ 10 MB → ~600-char chunks (100 overlap) → `text-embedding-3-small` → batched Pinecone upsert. |
| **Retrieval** | `topK = 4`, cosine score `> RAG_SIMILARITY_THRESHOLD` (default **0.72**), optional `documentIds` scope. |
| **Cost** | Zero-token greetings, query cache, no-match short-circuit, throttling — all preserved. |
| **Security** | Prompt injection guard, XML-delimited context, output canary, Helmet, DTO bounds. |
| **Mobile UI** | Glass surfaces, gradient accents, **Pinecone Vector DB • Active** status pill, document-aware starter prompts, Reanimated streaming + source bottom sheet. |

---

## 2. Pinecone setup

1. Sign up at [app.pinecone.io](https://app.pinecone.io/) (free tier available).
2. **Create index** (Serverless) — either mode works with DocuMind (auto-detected on startup):

   **A. Legacy vector index (OpenAI embeddings)**  
   Dimensions `1536`, metric `cosine`. No document schema.

   **B. Document-schema index (Pinecone integrated embedding)** — e.g. console quickstart with fields `title` + `chunk_text` (`embed` / `llama-text-embed-v2`). DocuMind writes via the **Documents API**, embeds chunks at upsert, and searches with `embed` on `chunk_text` (no OpenAI embedding calls for retrieval). Use **`RAG_SIMILARITY_THRESHOLD=0.25–0.45`** — scores are not on the same scale as cosine + OpenAI.

   Optional overrides: `PINECONE_EMBED_FIELD`, `PINECONE_DENSE_FIELD` (for BYO `dense_vector` schema fields).

3. **API key:** **API Keys** → create key → copy `PINECONE_API_KEY` (starts with `pcsk_`).
4. Put key and index name in `backend/.env` (see [templates](#5-environment-variables)).

**Metadata on each vector**

| Field | Purpose |
| --- | --- |
| `documentId` | Filter deletes & scoped search |
| `documentName` | Citations |
| `pageNumber` | Citations |
| `chunkIndex` | Stable vector id suffix |
| `textSnippet` | RAG context + source sheet |

Vector IDs: `{documentId}:{chunkIndex}`.

---

## 3. Migrate from Supabase

If you used the earlier pgvector version:

```bash
cd backend
npm uninstall @supabase/supabase-js
npm install @pinecone-database/pinecone
```

1. Remove from `backend/.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
2. Add: `PINECONE_API_KEY`, `PINECONE_INDEX_NAME`, optional `PINECONE_NAMESPACE`, `DATA_DIR=./data`.
3. Create the Pinecone index (section 2).
4. **Re-upload PDFs** — vectors now live in Pinecone; old Supabase rows are not migrated automatically.

---

## 4. Installation

### Backend

```bash
cd backend
npm install
```

Fresh backend dependency set:

```bash
npm install @nestjs/config@^4.0.4 @nestjs/throttler class-validator class-transformer \
  @pinecone-database/pinecone openai pdf-parse helmet
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

All native modules used ship in **Expo Go** (SDK 58).

---

## 5. Environment variables

### `backend/.env.example` → `backend/.env`

```dotenv
HOST=0.0.0.0
PORT=3000
CORS_ORIGINS=http://localhost:8081
DATA_DIR=./data

OPENAI_API_KEY=sk-proj-your-openai-key

PINECONE_API_KEY=pcsk_your-pinecone-api-key
PINECONE_INDEX_NAME=documind
PINECONE_NAMESPACE=documind

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

Use your PC’s **LAN IP**, not `localhost`, on a physical phone. Only `EXPO_PUBLIC_*` values are bundled into the app — **never** put OpenAI or Pinecone keys in the frontend.

---

## 6. Running & testing

**Terminal 1 — backend**

```bash
cd backend
cp .env.example .env   # then edit secrets
npm run start:dev
```

**Terminal 2 — frontend**

```bash
cd frontend
cp .env.example .env
npx expo start --clear
```

**Checks**

```bash
cd backend && npm test && npm run test:e2e
cd ../frontend && npx tsc --noEmit && npx expo lint
```

**On device (Expo Go)**

1. Open Knowledge Base → upload a PDF → wait for **Ready**.
2. Header shows **Pinecone Vector DB · Active · N docs · M chunks**.
3. Ask a content question → streaming answer + source chips → tap chip for excerpt + similarity %.
4. Send `thanks!` → **Instant · Zero-Token** badge, 0 API calls.
5. Keyboard: composer stays above keys; list scrolls with `KeyboardChatScrollView`.

---

## 7. API reference

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `POST` | `/rag/upload` | Multipart `file`, max 10 MB |
| `GET` | `/rag/documents` | Registry from `data/documents.json` |
| `DELETE` | `/rag/documents/:id` | Deletes registry row + Pinecone vectors (`documentId` filter) |
| `POST` | `/rag/chat` | SSE: `status` → `token` → `done` with `sources[]` |

---

## 8. Cost & security (unchanged)

- **Layers:** intent router (0 calls) → prompt guard → LRU cache → embed + Pinecone → `gpt-4o-mini`.
- **Models:** `text-embedding-3-small`, `gpt-4o-mini`, `max_completion_tokens` capped.
- **OWASP LLM:** injection patterns stripped/blocked, `<retrieved_context>` treated as untrusted data, output canary + secret redaction, 15 req/min/IP, question ≤ 1000 chars.

---

## 9. Troubleshooting

| Issue | Fix |
| --- | --- |
| Server won’t start / invalid env | Set `PINECONE_API_KEY` and `OPENAI_API_KEY`. Remove leftover `SUPABASE_*` vars. |
| `Vector knowledge base is unavailable` | Wrong index name, key, or index still provisioning (wait ~1 min). |
| Always “couldn’t find” despite upload | Lower `RAG_SIMILARITY_THRESHOLD` (e.g. `0.5`); `text-embedding-3-small` often scores 0.35–0.65 on good matches. Backend logs closest score when nothing passes threshold. |
| Phone can’t reach API | `EXPO_PUBLIC_BACKEND_URL` = LAN IP; allow port 3000 on Windows firewall (Private). |
| Empty document list after migration | Re-upload; registry is local JSON under `DATA_DIR`. |

**Production:** add auth + per-user namespaces/metadata filters; use Redis for cache/throttle when scaling horizontally.