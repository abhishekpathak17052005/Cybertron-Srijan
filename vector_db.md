# `vector_db.md` — LegalLens Server-Side Vector Database Architecture (ChromaDB)

---

## 1. Executive Summary & Architectural Role

To support fast semantic retrieval, similarity clustering, and graph-augmented RAG on legal contracts, **ChromaDB** is deployed directly as a server-side vector database instance.

This component handles dense vector indexing, cosine similarity nearest-neighbor lookup, metadata filtering, and automatic session-level record lifecycle management.

```text
[ User Query / Document Chunks ]
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. EMBEDDING PIPELINE (Google text-embedding-004)            │
│    • Converts clause text to 768-dimensional float arrays   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Dense Vectors + Metadata
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. CHROMADB VECTOR ENGINE (Server-Side)                     │
│    • HNSW Graph Index (`hnsw:space: cosine`)                │
│    • Metadata Filter Engine (`sessionId`, `riskLevel`)       │
│    • Local Persistent Storage (`/var/data/chroma_storage`)  │
└──────────────────────────────┬──────────────────────────────┘
                               │ Top-K Semantic Matches
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. GRAPH-AUGMENTED RAG COPILOT (Gemini 3.5 Flash)           │
│    • Traverses adjacent `connectedClauses` from metadata    │
│    • Generates grounded, cited answers                      │
└─────────────────────────────────────────────────────────────┘

```

---

## 2. Server Deployment Topologies

Depending on your production environment, ChromaDB can be deployed in one of two ways:

### Mode A: Standalone Docker Service (Recommended for Microservices / Render Web Service)

Runs ChromaDB as an independent container service listening on port `8000`.

```yaml
# docker-compose.yml
version: '3.8'

services:
  chromadb:
    image: chromadb/chroma:latest
    container_name: legallens-chromadb
    ports:
      - "8000:8000"
    volumes:
      - chroma_data:/chroma/chroma
    environment:
      - IS_PERSISTENT=TRUE
      - PERSISTENCE_DIRECTORY=/chroma/chroma
      - ANONYMIZED_TELEMETRY=FALSE
    restart: unless-stopped

volumes:
  chroma_data:
    driver: local

```

### Mode B: Embedded Persistent Process (Monolithic Node / Python Sidecar)

Runs inside the backend worker using disk-backed SQLite/Parquet files (`PersistentClient`).

---

## 3. Vector Collection Schema Specification

### 3.1 Collection Initialization

* **Collection Name:** `legal_clause_vectors`
* **Distance Metric:** Cosine (`hnsw:space: "cosine"`)
* **Embedding Dimensions:** 768 (`text-embedding-004`)

```python
import chromadb
from chromadb.config import Settings

# Persistent local client initialization
client = chromadb.PersistentClient(
    path="/var/data/chroma_storage",
    settings=Settings(anonymized_telemetry=False)
)

# Or HTTP client for Docker standalone service
# client = chromadb.HttpClient(host="localhost", port=8000)

collection = client.get_or_create_collection(
    name="legal_clause_vectors",
    metadata={"hnsw:space": "cosine"}
)

```

### 3.2 Data Structure Per Record

Every clause chunk inserted into ChromaDB contains 4 fundamental attributes:

| Field | Type | Description | Example |
| --- | --- | --- | --- |
| `ids` | `string` | Deterministic session + clause unique key | `"sess_89f0a2e1_CLAUSE_12"` |
| `embeddings` | `List[float]` | 768-dimensional normalized dense vector | `[0.0124, -0.0451, ..., 0.0892]` |
| `documents` | `string` | Verbatim text of the extracted legal clause | `"Either party may terminate..."` |
| `metadatas` | `dict` | Search filters, graph edges, and financial tags | *(See schema below)* |

#### Metadata Schema (`metadatas`)

> **ChromaDB Constraint:** Chroma metadata primitive values must be `string`, `int`, `float`, or `bool`. Nested objects or arrays must be serialized as JSON strings.

```json
{
  "sessionId": "sess_89f0a2e1",
  "documentType": "Residential Rental Agreement",
  "clauseId": "CLAUSE_12",
  "title": "Termination and Notice Period",
  "pageNumber": 5,
  "category": "Termination",
  "riskLevel": "HIGH",
  "isExplicitFinancial": true,
  "statedAmount": "null",
  "contingentPenalty": "₹20,000",
  "assignedTo": "Tenant",
  "obligationAction": "Submit written notice 60 days in advance",
  "connectedClauses": "[\"CLAUSE_7\", \"CLAUSE_18\", \"CLAUSE_21\"]",
  "createdAtTimestamp": 1788600000
}

```

---

## 4. Node.js Backend Integration

Because the LegalLens backend runs Node.js/Express, use the official `chromadb` npm client to communicate with the ChromaDB HTTP server.

### 4.1 Client Initialization (`src/config/chroma.js`)

```javascript
import { ChromaClient } from 'chromadb';

const CHROMA_SERVER_URL = process.env.CHROMA_SERVER_URL || 'http://localhost:8000';

export const chromaClient = new ChromaClient({
  path: CHROMA_SERVER_URL
});

export async function getClauseCollection() {
  return await chromaClient.getOrCreateCollection({
    name: 'legal_clause_vectors',
    metadata: { 'hnsw:space': 'cosine' }
  });
}

```

### 4.2 Ingestion & Bulk Vector Insertion (`src/services/vectorService.js`)

```javascript
import { getClauseCollection } from '../config/chroma.js';

export async function storeClauseVectors(sessionId, processedClauses) {
  const collection = await getClauseCollection();

  const ids = [];
  const embeddings = [];
  const documents = [];
  const metadatas = [];

  for (const clause of processedClauses) {
    ids.push(`${sessionId}_${clause.clauseId}`);
    embeddings.push(clause.embedding); // 768-dim from text-embedding-004
    documents.push(clause.clauseText);
    metadatas.push({
      sessionId: sessionId,
      documentType: clause.documentType || 'Contract',
      clauseId: clause.clauseId,
      title: clause.title,
      pageNumber: clause.pageNumber,
      category: clause.category || 'General',
      riskLevel: clause.riskLevel || 'LOW',
      isExplicitFinancial: Boolean(clause.financials?.isExplicit),
      statedAmount: String(clause.financials?.statedAmount || 'null'),
      contingentPenalty: String(clause.financials?.contingentPenalty || 'null'),
      assignedTo: clause.obligations?.assignedTo || 'Mutual',
      obligationAction: clause.obligations?.action || '',
      connectedClauses: JSON.stringify(clause.connectedClauses || []),
      createdAtTimestamp: Math.floor(Date.now() / 1000)
    });
  }

  await collection.add({
    ids,
    embeddings,
    documents,
    metadatas
  });

  return { insertedCount: ids.length };
}

```

---

## 5. Graph-Augmented RAG Retrieval Pipeline

Retrieval combines semantic nearest-neighbor search with deterministic 1-hop adjacency graph expansion.

```text
[ User Question ]
       │
       ▼
[ Embed Query: text-embedding-004 ]
       │
       ▼
[ ChromaDB collection.query() ]
  • Filter: { sessionId: currentSessionId }
  • n_results: 4
       │
       ▼
[ Top-K Primary Matches ]
       │
       ▼
[ Graph Traversal Loop ]
  • Parse `metadata.connectedClauses` JSON string
  • collection.get(ids=[linked_ids])
       │
       ▼
[ Combined Grounded Context ] ──► [ Gemini 3.5 Flash Inference ]

```

### 5.1 Query & Adjacency Expansion Function

```javascript
import { getClauseCollection } from '../config/chroma.js';

export async function retrieveGroundedContext(sessionId, queryEmbedding, topK = 4) {
  const collection = await getClauseCollection();

  // 1. Semantic Search with Session Partitioning
  const searchResults = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
    where: { sessionId: sessionId }
  });

  const primaryClauses = [];
  const secondaryClauseIdsToFetch = new Set();

  if (searchResults.ids[0]?.length) {
    for (let i = 0; i < searchResults.ids[0].length; i++) {
      const meta = searchResults.metadatas[0][i];
      const doc = searchResults.documents[0][i];
      const distance = searchResults.distances ? searchResults.distances[0][i] : null;

      primaryClauses.push({
        id: searchResults.ids[0][i],
        clauseId: meta.clauseId,
        title: meta.title,
        text: doc,
        page: meta.pageNumber,
        risk: meta.riskLevel,
        distance
      });

      // Collect connected clause IDs from DAG metadata
      try {
        const linked = JSON.parse(meta.connectedClauses || '[]');
        linked.forEach(cId => secondaryClauseIdsToFetch.add(`${sessionId}_${cId}`));
      } catch {
        // Fallback for empty/unparseable connected edges
      }
    }
  }

  // 2. Fetch Adjacency Graph Nodes (Multi-Hop Resolution)
  let linkedClauses = [];
  if (secondaryClauseIdsToFetch.size > 0) {
    const fetchedNodes = await collection.get({
      ids: Array.from(secondaryClauseIdsToFetch)
    });

    linkedClauses = fetchedNodes.ids.map((id, index) => ({
      id,
      clauseId: fetchedNodes.metadatas[index].clauseId,
      title: fetchedNodes.metadatas[index].title,
      text: fetchedNodes.documents[index],
      page: fetchedNodes.metadatas[index].pageNumber,
      risk: fetchedNodes.metadatas[index].riskLevel,
      isGraphExpansion: true
    }));
  }

  return {
    primaryClauses,
    linkedClauses
  };
}

```

---

## 6. Ephemeral Session Lifecycle & Automated Purging

Because LegalLens adheres to a **Zero-Storage / Ephemeral Mandate**, vectors must not persist indefinitely on the server.

### 6.1 Scheduled Purge Job (Agenda.js or Node-Cron)

A cron runner periodically sweeps ChromaDB and purges documents older than 24 hours ($86,400\text{ seconds}$).

```javascript
import cron from 'node-cron';
import { getClauseCollection } from '../config/chroma.js';

// Runs every hour at minute 0
cron.schedule('0 * * * *', async () => {
  try {
    const collection = await getClauseCollection();
    const cutoffTimestamp = Math.floor(Date.now() / 1000) - 86400; // 24 hours ago

    // Delete records matching TTL condition
    await collection.delete({
      where: {
        createdAtTimestamp: { "$lt": cutoffTimestamp }
      }
    });

    console.log(`[ChromaDB TTL]: Purged session records older than 24h.`);
  } catch (error) {
    console.error('[ChromaDB TTL Error]:', error);
  }
});

```

### 6.2 Explicit Session Termination Hook

When a user closes their workspace session or clicks "Clear Analysis":

```javascript
export async function deleteSessionVectors(sessionId) {
  const collection = await getClauseCollection();
  await collection.delete({
    where: { sessionId: sessionId }
  });
  return { success: true };
}

```

---

## 7. Operational Runbook & Server Maintenance

### 7.1 Health & Connectivity Check Endpoint

```javascript
// Express route: GET /api/health/chroma
app.get('/api/health/chroma', async (req, res) => {
  try {
    const heartbeat = await chromaClient.heartbeat();
    const collection = await getClauseCollection();
    const count = await collection.count();
    
    return res.status(200).json({
      status: 'HEALTHY',
      heartbeat,
      indexedClauseCount: count
    });
  } catch (error) {
    return res.status(503).json({
      status: 'UNHEALTHY',
      error: error.message
    });
  }
});

```

### 7.2 Storage Compaction & Backup Policy

* **Data Path:** `/var/data/chroma_storage`
* **Compaction:** Chroma uses SQLite for metadata and DuckDB/Clickhouse/hnswlib files. Restarting the Chroma container triggers index vacuuming.
* **Ephemeral Flag:** In production testing, setting `PERSISTENCE_DIRECTORY=""` keeps all vectors strictly in RAM, automatically wiping all vector data if the server reboots.

---

## 8. Environment Configuration Matrix

Add the following environment variables to your backend `.env` file:

```bash
# ChromaDB Connection
CHROMA_SERVER_URL=http://localhost:8000

# Vector Index Configuration
EMBEDDING_MODEL_DIMENSIONS=768
VECTOR_COLLECTION_NAME=legal_clause_vectors

# TTL Expiration (Seconds)
SESSION_VECTOR_TTL_SECONDS=86400

```