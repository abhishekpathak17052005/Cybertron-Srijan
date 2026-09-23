# LegalLens Project Information

## 1. Project Identity

**Project name:** LegalLens

**Description:** A decision-ready legal document intelligence platform that converts contracts into an interactive workspace for understanding financial exposure, operational obligations, deadlines, clause relationships, and document authenticity.

**Primary questions answered:**

1. What does this contract mean financially and operationally?
2. What can happen during dispute, termination, exit, or renewal scenarios?
3. Which clauses conflict, override, trigger, or depend on other clauses?
4. Does the uploaded document show signs of tampering or inconsistent statutory data?

**Supported document types:** PDF, DOCX, PNG, JPG, and other formats permitted by the upload middleware.

**Example contract types:** Residential rental agreements, commercial leases, service contracts, NDAs, and master service agreements.

## 2. Core Guarantees

- **Zero-disk raw document processing:** Uploads are handled with Multer memory storage. Raw files are not written to disk or object storage.
- **Ephemeral session data:** Extracted vectors and forensic audit records are designed to expire after 24 hours through MongoDB TTL indexes.
- **Grounded answers:** Copilot responses use vector retrieval, clause relationship expansion, and clause/page citations.
- **In-memory authenticity checks:** Forensic image analysis, statutory QR checks, and semantic chronology validation run without persisting the original file.
- **Proactive deadlines:** Extracted obligations can produce reminders at 72 hours, 24 hours, and 5 hours before a deadline.
- **Client-side voice playback:** Answers can be spoken with the browser Web Speech Synthesis API after citation, Markdown, and currency cleanup.

## 3. Current Architecture

```text
User browser
    |
    | React SPA, REST/JSON, multipart upload
    v
Frontend: React 19 + TypeScript + Vite + Tailwind
    |
    | /api requests
    v
Backend: Node.js 20+ + Express 4
    |-- In-memory document parsing
    |-- Gemini contract analysis and embeddings
    |-- Authenticity verification pipeline
    |-- Graph-augmented RAG chat
    |-- Agenda deadline scheduler
    |-- HMAC task actions
    |
    +--> MongoDB Atlas / Mongoose
    |       Vector clauses, task reminders, authenticity audits
    |       TTL expiration and vector search
    |
    +--> Google Gemini API
    |       Structured analysis and text embeddings
    |
    +--> SMTP relay through Nodemailer
            Deadline notification emails
```

**Deployment targets described by the project documentation:**

- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas
- AI: Google Gemini API
- Email: Any compatible SMTP provider

## 4. Main User Workflow

1. User uploads a contract from the frontend.
2. Backend accepts the file into a RAM-only Multer buffer with a 25 MB limit.
3. PDF, DOCX, or image content is extracted in memory.
4. Contract intelligence and authenticity analysis run, with independent checks where possible.
5. Gemini returns structured contract information such as risks, financials, obligations, clauses, relationships, and tasks.
6. Clause text is embedded into 768-dimensional vectors and stored with session metadata.
7. Deadline tasks are stored and scheduled.
8. The frontend renders the document workspace, dashboards, clause browser, graph, reminders, authenticity results, and Copilot.
9. Copilot queries retrieve relevant clauses and connected clauses, then returns cited reasoning.
10. The original upload buffer is dereferenced after processing or on error.
11. Session-scoped stored data expires after the configured TTL, currently documented as 24 hours.

## 5. Functional Modules

### 5.1 In-memory ingestion

- Endpoint: `POST /api/documents/analyze`
- Input: `multipart/form-data` with a `file` and optional recipient email.
- Middleware: `backend/src/middleware/uploadMemory.js`
- Parsers: `pdf-parse` for PDF and `mammoth` for DOCX.
- Images are processed from buffers with Sharp and/or Gemini.
- The file buffer is explicitly cleared after processing.

### 5.2 Structured contract intelligence

The analysis output is intended to include:

- Document type and summary.
- Plain-language clause explanations.
- Complexity rating.
- Fairness or counterparty-bias score.
- Risk scorecard for termination, financial, liability, and deposit exposure.
- Fixed or stated financial commitments.
- Contingent penalties and liabilities.
- User, counterparty, and mutual obligations.
- Clause relationship nodes and directional edges.
- Milestones, deadlines, and financial consequences.

### 5.3 Clause relationship graph

Clauses can be connected through relationships such as triggers, conditions, overrides, deductions, or dependencies. The UI presents these as a directional graph. A typical path is:

```text
Notice requirement -> Termination -> Penalty -> Deposit deduction
```

Risk levels are represented in the UI as high, medium, and low categories. Selecting a node exposes its text, risk, connected clauses, and operational interpretation.

### 5.4 Graph-augmented RAG Copilot

- Endpoint: `POST /api/chat/query`
- Input shape: `{ "sessionId": "sess_...", "question": "..." }`
- Retrieval stages:
  1. Embed the question.
  2. Search the current session's clause vectors.
  3. Expand top matches through `connectedClauses` metadata.
  4. Assemble grounded context.
  5. Ask Gemini for a plain-language answer with citations.
- Expected citation style includes clause identifiers and page numbers, for example `[CLAUSE 18 (Page 7)]`.
- The answer should distinguish contractual text from interpretation and provide a practical bottom line.

### 5.5 Voice assistant

The frontend speech sanitizer is intended to:

- Remove Markdown headings, emphasis, bullets, and code formatting.
- Convert Indian Rupee values into natural speech.
- Convert citations into phrases such as "according to Clause 12 on page 5".
- Use `window.speechSynthesis` for playback.
- Use speech boundary events to synchronize highlighting where supported.

### 5.6 Deadline reminders

Extracted tasks contain a title, clause reference, description, deadline, and financial impact. The scheduler creates reminders at:

- `T - 72 hours`: early warning.
- `T - 24 hours`: preparation warning.
- `T - 5 hours`: final warning.

Emails can include HMAC-protected actions:

- Mark the task as completed.
- Snooze the task for a selected duration.
- Leave the task pending and allow future reminders to run.

### 5.7 Authenticity and forensic verification

Dedicated endpoint: `POST /api/documents/verify-authenticity`

#### Layer 1: Forensic image analysis

- Uses Sharp in memory.
- Recompresses images at quality 95 for Error Level Analysis.
- Compares original and recompressed RGB data.
- Calculates average and maximum compression discrepancies.
- Uses local variance or hotspot thresholds to identify possible splices, altered digits, or pasted signatures.
- The analysis is non-destructive and does not write source files.

#### Layer 2: Statutory QR and registry checks

- Uses ZXing to decode QR and Data Matrix symbols.
- Preprocesses images with resizing and grayscale conversion.
- Recognizes official registry domains where configured, including StockHolding, GRAS, Kaveri, and selected registration portals.
- Extracts certificate numbers, GRNs, stamp duty, dates, and URLs where possible.
- Uses OCR or text-pattern fallback when a QR code is unavailable or unreadable.

#### Layer 3: Semantic and chronology checks

Gemini and rule-based checks compare statutory data with the contract body:

```text
Stamp purchase date <= execution date <= commencement date
```

Checks include:

- A stamp purchase date must not be later than the execution date.
- The statutory purchaser should match a contract party.
- Both primary parties should have execution/signature evidence.
- The document should contain at least two witness attestations where required.
- Referenced annexures or schedules should be present.

#### Composite score

```text
Final score = (Forensic score * 0.25)
            + (Statutory score * 0.40)
            + (Semantic score * 0.35)
```

Documented verdict tiers:

| Score | Verdict | Meaning |
| --- | --- | --- |
| 90-100 | VERIFIED_VALID | Strong registry, forensic, and semantic evidence |
| 70-89 | MODERATE_AUTHENTICITY_VERIFIED | Likely valid, but scan or compression quality reduces certainty |
| 40-69 | CAUTION_INCOMPLETE | Missing, degraded, or unverified evidence |
| 0-39 | HIGH_RISK_TAMPERED | Strong tampering signal or critical chronology anomaly |

Critical safety overrides may cap a tampered document's final score at 39.

## 6. API Surface

### Health

- `GET /health`
- `GET /api/health`
- Returns service health, uptime, database connection state, and timestamp.

### Documents

- `POST /api/documents/analyze`: Analyze and ingest a document.
- `POST /api/documents/verify-authenticity`: Run authenticity verification.
- `GET /api/documents/:sessionId`: Fetch session document data.

### Chat

- `POST /api/chat/query`: Run grounded graph-augmented Copilot retrieval and response generation.

### Tasks

- `GET /api/tasks`: List tasks.
- `POST /api/tasks`: Create a task.
- `PATCH /api/tasks/:id/toggle`: Toggle task state from the frontend.
- `GET /api/tasks/action`: Resolve a signed email action such as done or snooze.

## 7. Data Model

### `document_vectors`

Stores session-scoped extracted clauses and embeddings.

```text
_id: ObjectId
sessionId: string
documentType: string
clauseId: string
title: string
clauseText: string
pageNumber: number
embedding: number[]              # documented as 768 dimensions
metadata.category: string
metadata.riskLevel: LOW|MEDIUM|HIGH|CRITICAL
metadata.financials.isExplicit: boolean
metadata.financials.statedAmount: string|null
metadata.financials.contingentPenalty: string|null
metadata.obligations.assignedTo: User|Counterparty|Mutual
metadata.obligations.action: string
metadata.connectedClauses: string[]
createdAt: Date                  # TTL-controlled
```

Documented indexes:

- Vector index: `legal_vector_index`, cosine similarity, 768 dimensions.
- Session filter on `sessionId`.
- TTL index on `createdAt` with `expireAfterSeconds: 86400`.
- Compound lookup index on `sessionId` and `clauseId`.

### `task_reminders`

Stores deadline tasks, notification schedule, and action state.

```text
_id: ObjectId
sessionId: string
recipientEmail: string
documentName: string
task.title: string
task.clauseRef: string
task.description: string
task.deadline: Date
task.financialImpact: string
schedule: [{ type, runAt, sent, jobId? }]
status: PENDING|COMPLETED|SNOOZED|EXPIRED
snoozedUntil: Date|null
actionTokens.doneToken: string
actionTokens.snoozeToken: string
createdAt: Date
updatedAt: Date
```

### `authenticity_audits`

Stores the structured result of the authenticity pipeline and is intended to use the same 24-hour session lifecycle.

## 8. Technology Stack

### Backend

- Node.js 20+ with ES modules.
- Express 4.
- Mongoose 8.
- Multer memory storage.
- Google Generative AI SDK.
- Sharp 0.35 for image processing and ELA.
- `@zxing/library` for QR and barcode decoding.
- `pdf-parse` and Mammoth for in-memory document extraction.
- Agenda 5 for MongoDB-backed jobs.
- Nodemailer 6 for SMTP delivery.
- Node crypto HMAC-SHA256 for action tokens.
- Nanoid for session and task identifiers.
- CORS and dotenv.

### Frontend

- React 19.
- TypeScript 5.6.
- Vite 7.
- Tailwind CSS 4.
- Radix UI primitives.
- Lucide React icons.
- Wouter routing.
- Axios.
- Framer Motion.
- Recharts.
- React Hook Form and Zod where used.
- Web Speech Synthesis API.

### AI services described in project documentation

- Google Gemini Flash for structured extraction, reasoning, and RAG answers.
- Google embedding model for 768-dimensional clause vectors.
- Grok and Groq are documented as possible fallback providers in `tools.md`.

## 9. Repository Structure

```text
.
|-- README.md
|-- information.md
|-- spec.md
|-- features.md
|-- design.md
|-- authenticity.md
|-- tools.md
|-- vector_db.md
|-- test.md
|-- backend/
|   |-- package.json
|   |-- server.js
|   |-- render.yaml
|   |-- test-api.js
|   |-- test-analyze.js
|   |-- test-authenticity.js
|   |-- test-session-rag.js
|   `-- src/
|       |-- config/       # database, mailer, Agenda
|       |-- controllers/  # analysis, authenticity, chat, tasks
|       |-- middleware/   # memory upload and error handling
|       |-- models/       # vectors, audits, reminders
|       |-- routes/       # documents, chat, tasks
|       |-- services/     # Gemini, vector, graph, forensic, QR, statutory, mail
|       `-- utils/        # scoring, OCR cleanup, HMAC token generation
`-- frontend/
    |-- package.json
    |-- vite.config.ts
    |-- tsconfig.json
    |-- client/
    |   |-- index.html
    |   `-- src/
    |       |-- App.tsx
    |       |-- index.css
    |       |-- components/
    |       |-- contexts/
    |       |-- hooks/
    |       |-- lib/
    |       |-- pages/
    |       |-- services/
    |       `-- utils/
    |-- server/index.ts
    `-- shared/const.ts
```

## 10. Frontend Views

- **Home:** Contract pulse, overview, risk scorecard, financial ledger, obligations, authenticity summary, and Copilot.
- **Clause Intelligence:** Search, risk/category filters, clause list, plain-language inspector, and connected-clause navigation.
- **Clause Graph:** Interactive clause relationship DAG with risk-colored nodes and relationship paths.
- **Reminders:** Deadline radar, task completion, task creation, and notification schedule.
- **Settings:** Workspace preferences and privacy information.
- **Not Found:** Fallback route.

## 11. Local Setup

### Prerequisites

- Node.js 20 or newer.
- npm 10 or newer, or the frontend's configured pnpm package manager.
- Google Gemini API key.
- MongoDB Atlas connection string with vector search support.
- SMTP credentials for real email delivery; optional for local development.

### Backend

```powershell
cd backend
npm install
npm run dev
```

Default backend URL: `http://localhost:5000`

Health check: `http://localhost:5000/api/health`

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

The frontend is documented at `http://localhost:3000`. Vite proxies `/api/*` requests to the backend according to the local configuration.

## 12. Environment Variables

Backend variables:

| Variable | Required | Purpose |
| --- | --- | --- |
| `PORT` | No | Express port, default 5000 |
| `NODE_ENV` | No | Development or production mode |
| `BASE_URL` | No | Base URL used in generated links |
| `FRONTEND_URL` | No | Allowed frontend origin |
| `MONGODB_URI` | Yes | MongoDB Atlas connection string |
| `GEMINI_API_KEY` | Yes | Gemini API authentication |
| `GEMINI_MODEL` | No | Primary Gemini model identifier |
| `SMTP_HOST` | No | SMTP server host |
| `SMTP_PORT` | No | SMTP server port |
| `SMTP_USER` | No | SMTP username |
| `SMTP_PASS` | No | SMTP password or app password |
| `EMAIL_FROM` | No | Sender identity |
| `JWT_SECRET` | Yes | HMAC action-token secret |

Frontend variable:

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_API_URL` | No | Explicit backend API base URL; empty uses the Vite proxy |

Never place real API keys, database credentials, SMTP passwords, or signing secrets in this document or source control.

## 13. Tests and QA

### Backend tests

```powershell
cd backend
npm test
node test-analyze.js
node test-session-rag.js
node test-authenticity.js
```

These cover health and task APIs, analysis ingestion, vector/RAG behavior, graph expansion, HMAC actions, authenticity layers, chronology rules, scoring, and zero-disk expectations.

### Frontend checks

```powershell
cd frontend
npm run check
npm run build
```

`npm run check` runs TypeScript validation. `npm run build` creates the production Vite client and bundled frontend server output.

### Manual QA areas

- Upload a supported contract and confirm the workspace is populated.
- Verify the session and privacy indicators.
- Ask Copilot a clause question and confirm citations.
- Play an answer with voice synthesis and stop playback.
- Search and filter clauses.
- Navigate connected clauses from the graph and inspector.
- Create, complete, and snooze reminders.
- Test invalid and valid HMAC task action URLs.
- Inspect authenticity score, verdict, QR result, chronology, witness, and forensic badges.

## 14. Important Documentation Alignment Notes

- The current backend dependencies and models point to **MongoDB Atlas/Mongoose** as the implemented vector and session store.
- `vector_db.md` describes a **ChromaDB** alternative with local persistent storage. That design is not reflected in the current backend package or route structure and should be treated as an alternative or historical proposal unless the implementation is changed.
- Documentation uses several model names, including `gemini-3.5-flash`, `gemini-2.5-flash`, `gemini-3.6-flash`, `text-embedding-004`, and `gemini-embedding-001`. The values in the deployed environment and the active service implementation are authoritative.
- Some documents describe SSE streaming and some describe JSON responses. The active controller and frontend API client define the actual response contract.
- Authenticity analysis is an assessment aid and should not be treated as a legal certification or a substitute for professional legal advice.

## 15. Source Documents

This consolidated file is based on:

- `README.md`
- `spec.md`
- `features.md`
- `design.md`
- `authenticity.md`
- `tools.md`
- `vector_db.md`
- `test.md`
- Backend package, server, route, model, controller, and service structure
- Frontend package and client structure
