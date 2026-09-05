import VectorClause from "../models/VectorClause.js";
import { isConnected } from "../config/db.js";

// Ephemeral in-memory fallback for local dev when MongoDB Atlas Vector Search index is pending
const inMemoryClauseCache = new Map();

/**
 * Store a batch of clauses and their 768-dim embeddings
 */
export async function storeClauses(sessionId, clauses) {
  // Always update in-memory cache for ultra-fast local fallback
  inMemoryClauseCache.set(sessionId, clauses);

  if (!isConnected()) {
    console.log(`[VectorService] Stored ${clauses.length} clauses in ephemeral RAM cache for session ${sessionId}`);
    return clauses;
  }

  try {
    const docs = clauses.map((c) => ({
      sessionId,
      documentType: c.documentType || "Contract",
      clauseId: c.clauseId,
      title: c.title,
      clauseText: c.clauseText,
      pageNumber: c.pageNumber || 1,
      embedding: c.embedding,
      metadata: {
        category: c.category || "General",
        riskLevel: c.riskLevel || "LOW",
        score: c.score || 0,
        financials: c.financials || {},
        obligations: c.obligations || {},
        connectedClauses: c.connectedClauses || [],
      },
    }));

    await VectorClause.insertMany(docs);
    console.log(`✅ [VectorService] Inserted ${docs.length} clause vectors into MongoDB Atlas for session ${sessionId}`);
    return docs;
  } catch (err) {
    console.warn("⚠️ [VectorService] MongoDB insertion notice:", err.message);
    return clauses;
  }
}

/**
 * Approximate Nearest Neighbor (ANN) search via Atlas $vectorSearch or Cosine Similarity fallback
 */
export async function searchSimilarClauses(sessionId, queryEmbedding, limit = 4) {
  // 1. Attempt Atlas $vectorSearch if DB is connected
  if (isConnected()) {
    try {
      const pipeline = [
        {
          $vectorSearch: {
            index: "legal_vector_index",
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: Math.max(20, limit * 5),
            limit,
            filter: { sessionId: { $eq: sessionId } },
          },
        },
        {
          $project: {
            _id: 1,
            sessionId: 1,
            clauseId: 1,
            title: 1,
            clauseText: 1,
            pageNumber: 1,
            metadata: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ];

      const results = await VectorClause.aggregate(pipeline);
      if (results && results.length > 0) {
        return results;
      }
    } catch (err) {
      console.warn("⚠️ [VectorService] Atlas $vectorSearch unavailable, using cosine similarity:", err.message);
    }

    // Secondary DB query: fetch all session clauses and compute cosine similarity
    try {
      const sessionClauses = await VectorClause.find({ sessionId }).lean();
      if (sessionClauses.length > 0) {
        return rankByCosineSimilarity(sessionClauses, queryEmbedding, limit);
      }
    } catch (err) {
      console.warn("⚠️ [VectorService] DB query fallback error:", err.message);
    }
  }

  // 2. RAM Cache Cosine Similarity Fallback
  const cached = inMemoryClauseCache.get(sessionId) || [];
  if (cached.length > 0) {
    return rankByCosineSimilarity(cached, queryEmbedding, limit);
  }

  return [];
}

/**
 * Retrieve all clauses for a session
 */
export async function getClausesBySession(sessionId) {
  if (isConnected()) {
    try {
      const clauses = await VectorClause.find({ sessionId }).lean();
      if (clauses.length > 0) return clauses;
    } catch (err) {
      console.warn("⚠️ [VectorService] Fetch clauses error:", err.message);
    }
  }

  return inMemoryClauseCache.get(sessionId) || [];
}

/**
 * Compute Cosine Similarity between query vector and candidate clauses
 */
function rankByCosineSimilarity(candidates, queryVector, limit) {
  const scored = candidates.map((item) => {
    const sim = cosineSimilarity(queryVector, item.embedding || []);
    return {
      ...item,
      score: sim,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export default {
  storeClauses,
  searchSimilarClauses,
  getClausesBySession,
};
