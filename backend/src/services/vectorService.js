import VectorClause from "../models/VectorClause.js";
import { isConnected } from "../config/db.js";
import { generateDeterministicVector } from "./geminiService.js";
import documentSessionService from "./documentSessionService.js";

// Ephemeral in-memory fallback for local dev when MongoDB Atlas Vector Search index is pending
const inMemoryClauseCache = new Map();

// Canonical contract clauses for demo sessions
const DEMO_CLAUSES = [
  {
    clauseId: "CLAUSE_04",
    title: "Rent and payment schedule",
    category: "Financial",
    riskLevel: "LOW",
    score: 22,
    pageNumber: 2,
    clauseText: "The Tenant shall pay monthly rent of ₹25,000 on or before the fifth day of each calendar month.",
    plainLanguage: "Fixed monthly payment requirement. A 5-day grace period exists before late penalties begin.",
    financials: { isExplicit: true, statedAmount: "₹25,000", contingentPenalty: null },
    obligations: { assignedTo: "Tenant", action: "Pay monthly rent of ₹25,000 by the 5th" },
    connectedClauses: ["CLAUSE_05"],
  },
  {
    clauseId: "CLAUSE_06",
    title: "Security deposit",
    category: "Deposit",
    riskLevel: "MEDIUM",
    score: 48,
    pageNumber: 3,
    clauseText: "The security deposit of ₹50,000 shall be held by the Landlord in escrow and returned within 30 days of vacation subject to deductions permitted under this agreement.",
    plainLanguage: "The deposit return is conditioned on verified structural inspections and zero arrears.",
    financials: { isExplicit: true, statedAmount: "₹50,000", contingentPenalty: null },
    obligations: { assignedTo: "Landlord", action: "Return deposit in 30 days" },
    connectedClauses: ["CLAUSE_18"],
  },
  {
    clauseId: "CLAUSE_07",
    title: "Renewal and continuation",
    category: "Term",
    riskLevel: "MEDIUM",
    score: 41,
    pageNumber: 4,
    clauseText: "The agreement may be renewed by mutual written consent at least thirty days before the expiry date.",
    plainLanguage: "Renewal requires mutual written agreement and counterparty holds unilateral escalation rights upon renewal.",
    financials: { isExplicit: false, statedAmount: null, contingentPenalty: null },
    obligations: { assignedTo: "Both", action: "Submit 30-day renewal notice" },
    connectedClauses: ["CLAUSE_12"],
  },
  {
    clauseId: "CLAUSE_09",
    title: "Premises maintenance",
    category: "Liability",
    riskLevel: "LOW",
    score: 30,
    pageNumber: 5,
    clauseText: "The Landlord shall maintain the premises in tenantable condition, handling major structural, roof, and plumbing repairs, while Tenant handles routine wear.",
    plainLanguage: "Landlord is responsible for major structural repairs; Tenant handles minor day-to-day upkeep.",
    financials: { isExplicit: false, statedAmount: null, contingentPenalty: null },
    obligations: { assignedTo: "Landlord", action: "Maintain premises structure" },
    connectedClauses: ["CLAUSE_18"],
  },
  {
    clauseId: "CLAUSE_12",
    title: "Termination and notice period",
    category: "Termination",
    riskLevel: "HIGH",
    score: 82,
    pageNumber: 5,
    clauseText: "Either party may terminate this agreement by providing a 60-day written notice to the other party.",
    plainLanguage: "Strict 60-day advance notice required. Failure to comply forfeits security deposit and activates liquidated damages.",
    financials: { isExplicit: true, statedAmount: null, contingentPenalty: "₹20,000" },
    obligations: { assignedTo: "Tenant", action: "Submit 60-day advance written notice" },
    connectedClauses: ["CLAUSE_07", "CLAUSE_18", "CLAUSE_21"],
  },
  {
    clauseId: "CLAUSE_18",
    title: "Security deposit deductions",
    category: "Deposit",
    riskLevel: "MEDIUM",
    score: 57,
    pageNumber: 7,
    clauseText: "Deductions from the deposit may only be made for verified structural damage or unpaid dues beyond ordinary wear and tear. Deductions for normal wear-and-tear or repainting are strictly not permitted.",
    plainLanguage: "Protects tenant against arbitrary deductions for normal wear-and-tear like nail holes or routine repainting.",
    financials: { isExplicit: false, statedAmount: null, contingentPenalty: "Itemized damage invoices" },
    obligations: { assignedTo: "Landlord", action: "Provide itemized damage invoices" },
    connectedClauses: ["CLAUSE_06", "CLAUSE_21"],
  },
  {
    clauseId: "CLAUSE_21",
    title: "Early exit penalty",
    category: "Financial",
    riskLevel: "HIGH",
    score: 91,
    pageNumber: 8,
    clauseText: "Early termination without the required 60-day written notice shall incur a penalty equivalent to ₹20,000 as liquidated damages.",
    plainLanguage: "Liquidated damages clause directly connected to Clause 12. Enforces mandatory exit penalty.",
    financials: { isExplicit: true, statedAmount: null, contingentPenalty: "₹20,000" },
    obligations: { assignedTo: "Tenant", action: "Pay liquidated damages if 60-day notice is missed" },
    connectedClauses: ["CLAUSE_12", "CLAUSE_18"],
  },
  {
    clauseId: "CLAUSE_24",
    title: "Dispute resolution",
    category: "Liability",
    riskLevel: "LOW",
    score: 28,
    pageNumber: 11,
    clauseText: "Parties shall first attempt to resolve disputes through written communication before escalation to formal legal proceedings or arbitration.",
    plainLanguage: "Mandatory written amicable resolution attempt required prior to any court or arbitration filing.",
    financials: { isExplicit: false, statedAmount: null, contingentPenalty: null },
    obligations: { assignedTo: "Both", action: "Formal written notice before litigation" },
    connectedClauses: [],
  },
];

// Pre-seed demo sessions with embedded clauses
function initializeDemoCache() {
  const seeded = DEMO_CLAUSES.map((c) => ({
    ...c,
    embedding: generateDeterministicVector(`${c.clauseId} ${c.title} ${c.clauseText} ${c.plainLanguage}`),
    metadata: {
      category: c.category,
      riskLevel: c.riskLevel,
      score: c.score,
      financials: c.financials,
      obligations: c.obligations,
      connectedClauses: c.connectedClauses,
    },
  }));

  inMemoryClauseCache.set("sess_demo_default", seeded);
  inMemoryClauseCache.set("sess_demo", seeded);
}

initializeDemoCache();

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
 * Hybrid Search (Dense Vector + Lexical BM25 Keyword Matching + Reciprocal Rank Fusion)
 */
export async function searchSimilarClauses(sessionId, queryTextOrEmbedding, maybeQueryEmbedding, limit = 4) {
  // Handle polymorphic parameters: (sessionId, queryText, queryEmbedding, limit) OR (sessionId, queryEmbedding, limit)
  let queryText = "";
  let queryEmbedding = null;
  let targetLimit = limit;

  if (typeof queryTextOrEmbedding === "string") {
    queryText = queryTextOrEmbedding;
    queryEmbedding = maybeQueryEmbedding;
  } else if (Array.isArray(queryTextOrEmbedding)) {
    queryEmbedding = queryTextOrEmbedding;
    targetLimit = typeof maybeQueryEmbedding === "number" ? maybeQueryEmbedding : 4;
  }

  // 1. Fetch candidate pool for session
  let candidates = await getClausesBySession(sessionId);

  // If no candidates found for this session ID, check if an uploaded session is active
  if (!candidates || candidates.length === 0) {
    const effectiveId = documentSessionService.getActiveSessionId(sessionId);
    if (effectiveId && effectiveId !== sessionId) {
      candidates = await getClausesBySession(effectiveId);
    }
  }

  // Only fall back to pre-seeded demo clauses if NO document was uploaded across the system
  if (!candidates || candidates.length === 0) {
    const latestUploaded = documentSessionService.getLatestSessionId();
    if (!latestUploaded) {
      candidates = inMemoryClauseCache.get("sess_demo_default") || [];
    }
  }

  if (!candidates || candidates.length === 0) {
    return [];
  }

  // 2. Compute Dense Vector Rankings
  const denseRankings = [];
  if (queryEmbedding && Array.isArray(queryEmbedding)) {
    candidates.forEach((clause) => {
      const sim = cosineSimilarity(queryEmbedding, clause.embedding || []);
      denseRankings.push({ clause, score: sim });
    });
    denseRankings.sort((a, b) => b.score - a.score);
  }

  // 3. Compute Lexical / Keyword Rankings
  const lexicalRankings = [];
  candidates.forEach((clause) => {
    const lexScore = computeLexicalScore(queryText, clause);
    lexicalRankings.push({ clause, score: lexScore });
  });
  lexicalRankings.sort((a, b) => b.score - a.score);

  // 4. Reciprocal Rank Fusion (RRF)
  // RRF(d) = 1 / (k + rank_dense) + 1 / (k + rank_lexical), where k = 60
  const k = 60;
  const rrfScores = new Map();

  denseRankings.forEach((item, index) => {
    const id = item.clause.clauseId || item.clause.id;
    const rrf = 1 / (k + index + 1);
    rrfScores.set(id, (rrfScores.get(id) || 0) + rrf);
  });

  lexicalRankings.forEach((item, index) => {
    const id = item.clause.clauseId || item.clause.id;
    // Boost lexical if there is a strong keyword or explicit clause number match
    const boost = item.score > 5 ? 1.5 : 1.0;
    const rrf = (1 / (k + index + 1)) * boost;
    rrfScores.set(id, (rrfScores.get(id) || 0) + rrf);
  });

  // 5. Build final sorted results
  const clauseMap = new Map();
  candidates.forEach((c) => clauseMap.set(c.clauseId || c.id, c));

  const sortedIds = Array.from(rrfScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, targetLimit)
    .map(([id]) => id);

  const results = sortedIds.map((id) => {
    const clause = clauseMap.get(id);
    return {
      ...clause,
      score: rrfScores.get(id),
    };
  });

  return results;
}

/**
 * Retrieve all clauses for a session
 */
export async function getClausesBySession(sessionId) {
  if (isConnected()) {
    try {
      const clauses = await VectorClause.find({ sessionId }).lean();
      if (clauses && clauses.length > 0) return clauses;
    } catch (err) {
      console.warn("⚠️ [VectorService] Fetch clauses error:", err.message);
    }
  }

  const cached = inMemoryClauseCache.get(sessionId);
  if (cached && cached.length > 0) return cached;

  // Check documentSessionService for this session
  const docContext = documentSessionService.getDocumentContext(sessionId);
  if (docContext && docContext.clauses && docContext.clauses.length > 0) {
    return docContext.clauses;
  }

  // Fallback to demo clauses for explicit demo sessions ONLY if no uploaded document exists
  if (!sessionId || sessionId.includes("demo")) {
    const latestUploaded = documentSessionService.getLatestSessionId();
    if (!latestUploaded) {
      return inMemoryClauseCache.get("sess_demo_default") || [];
    }
  }

  return [];
}

/**
 * Compute Lexical Keyword Relevance Score dynamically across clause fields
 */
function computeLexicalScore(query, clause) {
  if (!query) return 0;

  const q = query.toLowerCase();
  let score = 0;

  // 1. Explicit Clause/Section Number Matching (e.g. "Clause 18", "Clause 4", "Section 2", "Cl. 21")
  const clauseNumMatch = q.match(/(?:clause|cl\.?|section|sec\.?)\s*0?(\d+)/i);
  if (clauseNumMatch) {
    const num = parseInt(clauseNumMatch[1], 10);
    const clauseIdNum = parseInt((clause.clauseId || clause.id || "").replace(/\D/g, ""), 10);
    if (num === clauseIdNum || (clause.title && clause.title.includes(String(num)))) {
      score += 50; // Decisive match for explicitly requested clause
    }
  }

  // 2. Dynamic matching across title, category, clause text, and summary
  const titleText = (clause.title || "").toLowerCase();
  const categoryText = (clause.category || clause.metadata?.category || "").toLowerCase();
  const clauseBody = (clause.clauseText || clause.text || "").toLowerCase();
  const plainText = (clause.plainLanguage || clause.summary || "").toLowerCase();
  const fullText = `${titleText} ${categoryText} ${clauseBody} ${plainText}`;

  // Words tokenized
  const words = q.replace(/[^\w\s₹$€]/g, " ").split(/\s+/).filter((w) => w.length > 2);
  const stopWords = new Set(["the", "and", "what", "is", "for", "with", "this", "that", "can", "does", "from", "how", "under", "when", "are", "about"]);

  for (const w of words) {
    if (stopWords.has(w)) continue;

    if (titleText.includes(w)) {
      score += 5.0;
    }
    if (categoryText.includes(w)) {
      score += 3.5;
    }
    if (clauseBody.includes(w)) {
      score += 2.0;
    }
    if (plainText.includes(w)) {
      score += 2.0;
    }
    if (/\d/.test(w) && fullText.includes(w)) {
      score += 4.0;
    }
  }

  // 3. Exact multi-word phrase boost
  if (words.length >= 2) {
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      if (fullText.includes(bigram)) {
        score += 8.0;
      }
    }
  }

  return score;
}

/**
 * Compute Cosine Similarity between two dense vectors
 */
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
