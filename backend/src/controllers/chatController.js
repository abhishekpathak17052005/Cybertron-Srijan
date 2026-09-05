import geminiService from "../services/geminiService.js";
import vectorService from "../services/vectorService.js";
import graphService from "../services/graphService.js";

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

    console.log(`💬 [Chat] Query for session ${sessionId || "demo"}: "${question}"`);

    // 1. Generate query embedding (768 dims)
    const queryEmbedding = await geminiService.generateEmbedding(question);

    // 2. Vector search (Top-K = 4)
    let retrieved = [];
    if (sessionId) {
      retrieved = await vectorService.searchSimilarClauses(sessionId, queryEmbedding, 4);
    }

    // 3. Graph Traversal: 1-hop adjacency expansion over connectedClauses
    let expandedClauses = retrieved;
    let graphPath = [];

    if (sessionId && retrieved.length > 0) {
      const graphResult = await graphService.traverseAdjacency(sessionId, retrieved, 1);
      expandedClauses = graphResult.expandedClauses;
      graphPath = graphResult.graphPath;
    }

    // If no specific session clauses found (e.g. initial demo state), provide smart defaults
    if (expandedClauses.length === 0) {
      expandedClauses = [
        {
          clauseId: "CLAUSE_12",
          title: "Termination and notice period",
          pageNumber: 5,
          clauseText: "Either party may terminate this agreement by providing a 60-day written notice to the other party.",
          metadata: {
            category: "Termination",
            riskLevel: "HIGH",
            financials: { contingentPenalty: "₹20,000" },
            connectedClauses: ["CLAUSE_07", "CLAUSE_21"],
          },
        },
        {
          clauseId: "CLAUSE_21",
          title: "Early exit penalty",
          pageNumber: 8,
          clauseText: "Early termination without the required 60-day written notice shall incur a penalty equivalent to ₹20,000.",
          metadata: {
            category: "Financial",
            riskLevel: "HIGH",
            financials: { contingentPenalty: "₹20,000" },
            connectedClauses: ["CLAUSE_12"],
          },
        },
      ];
      graphPath = ["CLAUSE_12", "CLAUSE_21"];
    }

    // 4. Grounded inference via Gemini 3.5/2.5 Flash
    const chatResult = await geminiService.generateChatAnswer({
      question,
      retrievedClauses: expandedClauses,
      graphPath,
    });

    // Check if client requested SSE stream
    if (req.headers.accept === "text/event-stream") {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      // Send answer text in chunks
      const words = chatResult.answer.split(" ");
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
