import geminiService from "../services/geminiService.js";
import vectorService from "../services/vectorService.js";
import graphService from "../services/graphService.js";
import documentSessionService from "../services/documentSessionService.js";

/**
 * POST /api/chat/query
 * Graph-Augmented RAG Copilot query pipeline
 */
export async function queryChat(req, res, next) {
  try {
    const { sessionId, question } = req.body;

    if (!question || typeof question !== "string") {
      return res.status(400).json({
        success: false,
        error: "A valid question string is required.",
      });
    }

    // Resolve active session ID (auto-routes to recently uploaded document if present)
    const effectiveSessionId = documentSessionService.getActiveSessionId(sessionId);
    const documentContext = documentSessionService.getDocumentContext(effectiveSessionId);

    console.log(`💬 [Chat] Query for document "${documentContext.documentName}" (${effectiveSessionId}): "${question}"`);

    // 1. Generate query embedding (768 dims)
    const queryEmbedding = await geminiService.generateEmbedding(question);

    // 2. Hybrid Search on the target document
    let retrieved = await vectorService.searchSimilarClauses(
      effectiveSessionId,
      question,
      queryEmbedding,
      4
    );

    // If active session vector search returned nothing, check documentContext clauses
    if ((!retrieved || retrieved.length === 0) && documentContext.clauses && documentContext.clauses.length > 0) {
      retrieved = documentContext.clauses.slice(0, 4);
    }

    // Fallback to demo clauses ONLY if no uploaded document is present in the system
    if ((!retrieved || retrieved.length === 0) && !documentContext.hasUploadedDoc) {
      retrieved = await vectorService.searchSimilarClauses(
        "sess_demo_default",
        question,
        queryEmbedding,
        4
      );
    }

    // 3. Graph Traversal: 1-hop adjacency expansion over connectedClauses
    let expandedClauses = retrieved || [];
    let graphPath = [];

    if (expandedClauses.length > 0) {
      const graphResult = await graphService.traverseAdjacency(effectiveSessionId, expandedClauses, 1);
      expandedClauses = graphResult.expandedClauses || expandedClauses;
      graphPath = graphResult.graphPath || [];
    }

    // 4. Grounded inference strictly scoped to the active document
    const chatResult = await geminiService.generateChatAnswer({
      question,
      retrievedClauses: expandedClauses,
      graphPath,
      documentContext,
    });

    // Check if client requested SSE stream
    if (req.headers.accept === "text/event-stream") {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Send answer text in chunks
      const words = (chatResult.answer || "").split(" ");
      for (let i = 0; i < words.length; i += 3) {
        const chunk = words.slice(i, i + 3).join(" ") + " ";
        res.write(`event: chunk\ndata: ${JSON.stringify({ text: chunk })}\n\n`);
      }

      // Send metadata
      res.write(
        `event: metadata\ndata: ${JSON.stringify({
          citations: chatResult.citations,
          graphPath: chatResult.connectedClauses,
        })}\n\n`
      );

      res.write("event: end\ndata: [DONE]\n\n");
      return res.end();
    }

    // Default JSON response
    return res.status(200).json({
      success: true,
      answer: chatResult.answer,
      citations: chatResult.citations,
      connectedClauses: chatResult.connectedClauses,
      graphPath,
    });
  } catch (error) {
    next(error);
  }
}

export default { queryChat };
