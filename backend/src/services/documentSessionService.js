/**
 * Document Session Registry
 * Manages active uploaded documents, full extracted text, and session routing.
 * Ensures the Grounded RAG Copilot strictly answers on the user's recently uploaded document.
 */

const documentSessions = new Map();
let latestUploadedSessionId = null;

/**
 * Register a newly analyzed document
 */
export function registerSession(sessionId, sessionData) {
  const record = {
    sessionId,
    documentName: sessionData.documentName || "Uploaded Document",
    documentType: sessionData.documentType || "Legal Contract",
    rawText: sessionData.rawText || "",
    summary: sessionData.summary || {},
    financialLedger: sessionData.financialLedger || {},
    obligations: sessionData.obligations || {},
    clauses: sessionData.clauses || [],
    dag: sessionData.dag || {},
    tasks: sessionData.tasks || [],
    createdAt: new Date(),
  };

  documentSessions.set(sessionId, record);
  latestUploadedSessionId = sessionId;

  console.log(`📁 [DocumentSession] Registered active document "${record.documentName}" for session ${sessionId}`);
  return record;
}

/**
 * Get session details by ID
 */
export function getSession(sessionId) {
  return documentSessions.get(sessionId) || null;
}

/**
 * Get ID of the most recently uploaded document
 */
export function getLatestSessionId() {
  return latestUploadedSessionId;
}

/**
 * Resolve effective session ID
 * If requested session is a demo or missing, but an actual document was uploaded,
 * automatically routes to the recently uploaded document!
 */
export function getActiveSessionId(requestedSessionId) {
  if (
    requestedSessionId &&
    requestedSessionId !== "sess_demo" &&
    requestedSessionId !== "sess_demo_default" &&
    documentSessions.has(requestedSessionId)
  ) {
    return requestedSessionId;
  }

  // If a document was uploaded in this server lifetime, prioritize it
  if (latestUploadedSessionId && documentSessions.has(latestUploadedSessionId)) {
    return latestUploadedSessionId;
  }

  return requestedSessionId || "sess_demo_default";
}

/**
 * Retrieve rich document context for RAG inference
 */
export function getDocumentContext(sessionId) {
  const effectiveId = getActiveSessionId(sessionId);
  const session = documentSessions.get(effectiveId);

  if (session) {
    // Generate clean text excerpt (up to 25,000 chars)
    let textExcerpt = session.rawText ? session.rawText.slice(0, 25000) : "";
    if (!textExcerpt && session.clauses?.length) {
      textExcerpt = session.clauses
        .map((c) => `[${c.clauseId || c.id}]: ${c.title}\n${c.clauseText || c.text || c.plainLanguage || ""}`)
        .join("\n\n");
    }

    return {
      sessionId: effectiveId,
      documentName: session.documentName,
      documentType: session.documentType,
      summary: session.summary,
      textExcerpt,
      clauses: session.clauses,
      hasUploadedDoc: true,
    };
  }

  return {
    sessionId: "sess_demo_default",
    documentName: "Residential Rental Agreement (Demo Template)",
    documentType: "Residential Rental Agreement",
    summary: {},
    textExcerpt: "",
    clauses: [],
    hasUploadedDoc: false,
  };
}

export default {
  registerSession,
  getSession,
  getLatestSessionId,
  getActiveSessionId,
  getDocumentContext,
};
