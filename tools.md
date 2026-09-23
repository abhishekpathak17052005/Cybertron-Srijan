# `tools.md` — LegalLens Technology Stack, APIs, Libraries & Tools Guide

> Comprehensive catalog of every tool, programming language, framework, API service, npm library, and browser standard powering LegalLens.

---

## 1. Architectural Technology Overview

```text
               ┌────────────────────────────────────────────────────────┐
               │                  CLIENT WORKSPACE                      │
               │   React 19 · TypeScript · Vite 7 · Tailwind CSS 4      │
               │   Radix UI Primitives · Lucide Icons · Web Speech API  │
               └───────────────────────────┬────────────────────────────┘
                                           │  JSON / Multipart / REST
                                           ▼
               ┌────────────────────────────────────────────────────────┐
               │                    BACKEND ENGINE                      │
               │   Node.js 20+ (ESM) · Express 4 · In-Memory Multer     │
               │   Sharp (libvips ELA) · ZXing (Optical 2D Barcodes)    │
               │   Agenda.js (MongoDB Job Queue) · Crypto (HMAC-SHA256) │
               └──────────────┬─────────────────────────┬───────────────┘
                              │                         │
            ┌─────────────────┴──────────┐   ┌──────────┴─────────────────┐
            │       AI & LLM LAYER       │   │      PERSISTENCE LAYER     │
            │  Google Gemini 3.5 Flash   │   │  MongoDB Atlas             │
            │  Google Gemini 2.5 Flash   │   │  $vectorSearch (768 dims)  │
            │  text-embedding-004        │   │  24-Hour TTL Auto-Expiry   │
            └────────────────────────────┘   └────────────────────────────┘
```

---

## 2. Categorized Inventory of Technologies

---

### 1. Artificial Intelligence & LLM Engines

| Technology | Provider | Model / Endpoint | Role in LegalLens |
| :--- | :--- | :--- | :--- |
| **Google Gemini 3.5 Flash** | Google Cloud / DeepMind | `gemini-3.5-flash` | Primary reasoning model for structured contract extraction (fairness scores, risk scorecard, financial ledger, bilateral obligations, DAG edges, plain-language translation). |
| **Google Gemini 2.5 Flash** | Google Cloud / DeepMind | `gemini-2.5-flash` | Fallback LLM for fast inference and semantic chronology verification during high-traffic spikes. |
| **Google Generative AI SDK** | Google (`@google/generative-ai`) | SDK v0.24.0 | Official Node.js client managing Gemini API authentication, structured JSON schema prompting (`responseMimeType`), and streaming responses. |
| **text-embedding-004** | Google Cloud | `models/text-embedding-004` | Generates 768-dimensional dense vector embeddings for individual clauses to support semantic search. |

---

### 2. Computer Vision, Optical Forensics & Document Parsers

| Library / Tool | Version | License | Operational Role |
| :--- | :--- | :--- | :--- |
| **Sharp** | `^0.35.4` | Apache-2.0 | High-performance image processing engine powered by native `libvips`. Executes **in-memory Error Level Analysis (ELA)** at $Q = 95$, extracts raw RGB buffers, and calculates $64 \times 64$ px sliding window variance without disk writes. |
| **@zxing/library** | `^0.23.0` | Apache-2.0 | Multi-format 1D/2D optical barcode and QR code reader port of Zebra Crossing. Decodes e-Stamp barcodes, Data Matrix codes, and extracts official state registry payment URLs. |
| **pdf-parse** | `^1.1.1` | MIT | Pure JavaScript library that inspects and extracts raw text streams and page counts directly from in-memory PDF buffers without external CLI dependencies. |
| **Mammoth** | `^1.9.0` | BSD-2-Clause | In-memory DOCX / Office Open XML converter. Extracts raw text and structure from Word documents while ignoring proprietary formatting junk. |

---

### 3. Database, Vector Search & Ephemeral Storage

| Technology | Version | Ecosystem | Operational Role |
| :--- | :--- | :--- | :--- |
| **MongoDB Atlas** | v7.0+ | Cloud Database | Primary cloud data platform hosting ephemeral session vectors, task reminders, and forensic audit records. |
| **MongoDB Vector Search** | Native `$vectorSearch` | Atlas Search | Ingests 768-dimensional clause vectors and performs Approximate Nearest Neighbor (ANN) search via Hierarchical Navigable Small World (HNSW) indexing. |
| **Mongoose** | `^8.9.5` | ODM | Object Data Modeling library defining schemas (`VectorClause`, `TaskReminder`, `AuthenticityAudit`), validation rules, and connection pooling. |
| **MongoDB TTL Indexes** | Native `expires: 86400` | Database Feature | Automatically purges documents after 24 hours (86,400 seconds) to strictly enforce the platform's zero-retention privacy guarantee. |

---

### 4. Background Job Scheduling & Task Queues

| Technology | Version | Ecosystem | Operational Role |
| :--- | :--- | :--- | :--- |
| **Agenda.js** | `^5.0.0` | MIT | Lightweight background job scheduler backed directly by MongoDB. Replaces complex Redis clusters to manage deferred deadline notifications. |
| **Multi-Stage Reminders** | Custom Engine | Built on Agenda | Automatically calculates and schedules milestone dispatches for obligations at $T - 72\text{h}$ (3 days), $T - 24\text{h}$ (1 day), and $T - 5\text{h}$ (5 hours). |

---

### 5. Email Relays & Cryptographic Security

| Technology | Version | Ecosystem | Operational Role |
| :--- | :--- | :--- | :--- |
| **Nodemailer** | `^6.10.0` | MIT | Enterprise-grade SMTP client dispatching styled, responsive dark-mode HTML deadline notifications with fallback to Ethereal dev logging. |
| **Node.js Crypto (HMAC-SHA256)** | Built-in | Node Core | Generates tamper-proof action tokens (`doneToken`, `snoozeToken`) embedded in email buttons, enabling one-click task resolution without login friction. |
| **Nanoid** | `^5.1.5` | MIT | Cryptographically secure, URL-safe, non-sequential unique identifier generator used for session IDs (`sess_...`) and task IDs. |

---

### 6. Backend Server & Middleware

| Technology | Version | Ecosystem | Operational Role |
| :--- | :--- | :--- | :--- |
| **Node.js** | v20+ / v24+ | Runtime | High-performance asynchronous V8 runtime running ES Modules (`type: "module"`). |
| **Express** | `^4.21.2` | Web Framework | Minimalist web framework handling routing (`/api/documents`, `/api/chat`, `/api/tasks`, `/api/health`), request validation, and error cascades. |
| **Multer** | `^1.4.5-lts.1` | Middleware | Multipart form-data parser configured with `memoryStorage()` to keep uploaded files entirely in RAM buffers. |
| **CORS** | `^2.8.5` | Middleware | Configures Cross-Origin Resource Sharing headers for secure communication between Vite (`localhost:3000`) and Express (`localhost:5000`). |
| **Dotenv** | `^16.4.7` | Utility | Ingests environment configurations (`GEMINI_API_KEY`, `MONGODB_URI`, `SMTP_HOST`) into `process.env`. |

---

### 7. Frontend Framework, State & Routing

| Technology | Version | Ecosystem | Operational Role |
| :--- | :--- | :--- | :--- |
| **React** | `^19.2.1` | Library | Component library utilizing modern React 19 primitives, concurrent rendering, and reactive hooks. |
| **TypeScript** | `^5.6.3` | Language | Strict static typing for contract data models (`ClauseItem`, `DocumentData`, `AuthenticityAudit`, `DAGNode`, `TaskItem`). |
| **Vite** | `^7.1.7` | Build Tool | Next-generation frontend tooling providing sub-second HMR and optimized asset bundling via esbuild. |
| **Wouter** | `^3.3.5` | Routing | Ultra-lightweight (~1.5 KB) client-side router managing tab navigation without bloated bundle overhead. |
| **Axios** | `^1.12.0` | HTTP Client | Promise-based HTTP client managing multipart file uploads, upload progress callbacks (`onUploadProgress`), and API timeout handling. |
| **DocumentContext** | Custom Context | React Context API | Central reactive state hub managing active contract intelligence, session IDs, task mutations, and forensic audit results with `sessionStorage` caching. |

---

### 8. UI Components, Styling & Icons

| Technology | Version | Ecosystem | Operational Role |
| :--- | :--- | :--- | :--- |
| **Tailwind CSS** | `^4.1.14` | Styling Engine | Utility-first CSS framework for rapid layout composition, typography sizing, and grid setups. |
| **Custom Design Tokens** | Custom CSS | `index.css` | Bespoke dark-mode palette (`--ink: #0C0D0C`, `--panel: #151714`, `--lime: #E58A2B`, `--coral: #E0645A`, `--success: #8FBF72`). |
| **Radix UI Primitives** | Various | UI Library | Unstyled, fully accessible UI components including dialogs, tooltips, tabs, dropdowns, and scroll areas. |
| **Lucide React** | `^0.453.0` | Iconography | High-quality, consistent SVG icon set (e.g. `ShieldCheck`, `Fingerprint`, `Clock3`, `TrendingUp`, `QrCode`, `FileCheck2`). |
| **Glassmorphism & Animate CSS** | Custom + `tw-animate-css` | Visuals | Smooth entry animations (`fade-up`, `delay-1`, `delay-2`), backdrop blurs (`backdrop-filter: blur(10px)`), and radial glow rings. |

---

### 9. Speech & Phonetic Processing

| Technology | Environment | Operational Role |
| :--- | :--- | :--- |
| **Web Speech Synthesis API** | Native Browser (`window.speechSynthesis`) | Standardized browser voice engine converting legal answers into spoken voice without third-party cloud audio billing. |
| **Speech Sanitizer** | Custom Utility ([`speechSanitizer.ts`](file:///d:/Project/Cybertron-Srijan/frontend/client/src/utils/speechSanitizer.ts)) | Pre-TTS phonetic translation pipeline converting Indian currency numbers (`₹25,000` $\rightarrow$ *"twenty-five thousand rupees"*), sanitizing citations, and listening to `onboundary` events for synchronized word highlighting. |

---

### 10. Development, QA & Testing Tools

| Tool | Invocation | Operational Role |
| :--- | :--- | :--- |
| **Node.js Watch Mode** | `node --watch server.js` | Built-in zero-dependency hot-reloader for the backend development process. |
| **TypeScript Compiler** | `npm run check` (`tsc --noEmit`) | Validates all TypeScript types across the frontend codebase with zero compile-time emit. |
| **Vite Production Bundler** | `npm run build` | Compiles and minifies client assets into `dist/public/` using Rollup and esbuild. |
| **test-authenticity.js** | `node test-authenticity.js` | 27-test automated test runner validating Layer 1 ELA, Layer 2 optical QR decoding, Layer 3 chronology, and composite scoring. |
| **test-api.js** | `npm test` | Automated integration suite validating MongoDB connection, health endpoints, RAG copilot, and HMAC tokens. |

---

## 3. Environment Variables Reference

| Variable | Scope | Mandatory? | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Backend | Optional | Port for the Express server (default: `5000`). |
| `NODE_ENV` | Backend | Optional | Environment mode (`development` or `production`). |
| `MONGODB_URI` | Backend | **Yes** | MongoDB Atlas connection string with replica set options. |
| `GEMINI_API_KEY` | Backend | **Yes** | Google Gemini API key used for structured contract intelligence and vector embeddings. |
| `GEMINI_MODEL` | Backend | Optional | Model identifier (defaults to `gemini-3.5-flash` with `gemini-2.5-flash` fallback). |
| `SMTP_HOST` | Backend | Optional | Outgoing SMTP host (e.g. `smtp.gmail.com`). If omitted, logs preview URLs to console. |
| `SMTP_PORT` | Backend | Optional | SMTP port (e.g. `587` for TLS). |
| `SMTP_USER` | Backend | Optional | Authenticated email address used as the sender. |
| `SMTP_PASS` | Backend | Optional | App-specific password or SMTP relay credential. |
| `EMAIL_FROM` | Backend | Optional | Branded sender header (e.g. `"LegalLens <notifications@legallens.ai>"`). |
| `JWT_SECRET` | Backend | **Yes** | Secret cryptographic key used to sign and verify HMAC-SHA256 action tokens. |
| `VITE_API_URL` | Frontend | Optional | Base URL for the backend API. If empty, Vite dev server proxies `/api/*` to port `5000`. |
