import { nanoid } from "nanoid";
import { runErrorLevelAnalysis } from "../services/forensicService.js";
import { extractStatutoryQR } from "../services/qrScannerService.js";
import { auditSemanticAuthenticity } from "../services/statutoryService.js";
import { calculateAuthenticityScore } from "../utils/authenticityScorer.js";
import { extractDocumentContent } from "../utils/ocrCleaner.js";
import AuthenticityAudit from "../models/AuthenticityAudit.js";
import { isConnected } from "../config/db.js";

/**
 * Reusable full authenticity audit orchestrator across Layers 1, 2, and 3
 * Adheres strictly to Zero-Disk mandate: all processing happens in RAM buffers.
 */
export async function runFullAuthenticityAudit({
  buffer,
  mimetype = "",
  originalname = "",
  text = "",
  sessionId = "",
}) {
  const activeSessionId = sessionId || `sess_${Date.now()}_${nanoid(8)}`;

  // 1. If text is not provided, extract in-memory
  let extractedText = text;
  if (!extractedText && buffer) {
    try {
      const content = await extractDocumentContent(buffer, mimetype, originalname);
      extractedText = content.text || "";
    } catch {
      extractedText = "";
    }
  }

  // 2. Layer 1: In-memory Error Level Analysis (ELA)
  const forensicResult = await runErrorLevelAnalysis(buffer, mimetype, originalname);

  // 3. Layer 2: Statutory & Registry QR Scanner
  const statutoryResult = await extractStatutoryQR(
    buffer,
    mimetype,
    originalname,
    extractedText
  );

  // 4. Layer 3: Semantic & Chronological Coherence Engine
  const semanticResult = await auditSemanticAuthenticity(extractedText, statutoryResult);

  // 5. Composite Score & Badge Generation
  const scoreResult = calculateAuthenticityScore(
    forensicResult,
    statutoryResult,
    semanticResult
  );

  const auditReport = {
    forensics: {
      elaPassed: forensicResult.elaPassed,
      tamperAlert: forensicResult.tamperAlert,
      avgCompressionDelta: forensicResult.avgCompressionDelta,
      maxCompressionDiscrepancy: forensicResult.maxCompressionDiscrepancy,
      details: forensicResult.details,
    },
    statutory: {
      qrDetected: statutoryResult.qrDetected,
      registryDomain: statutoryResult.registryDomain,
      certificateNumber: statutoryResult.certificateNumber,
      stampAmountPaid: statutoryResult.stampAmountPaid,
      verified: statutoryResult.verified,
      details: statutoryResult.details,
    },
    semantics: {
      chronologySound: semanticResult.chronologyCheck?.isChronologicallySound ?? true,
      stampDate: semanticResult.chronologyCheck?.stampPurchaseDate,
      executionDate: semanticResult.chronologyCheck?.executionDate,
      commencementDate: semanticResult.chronologyCheck?.commencementDate,
      partiesMatched: semanticResult.partiesMatch?.isMatch ?? true,
      witnessesFound: semanticResult.executionHealth?.witnessCount ?? 2,
      details: semanticResult.details,
    },
  };

  const auditPayload = {
    sessionId: activeSessionId,
    fileName: originalname,
    sourceType: forensicResult.sourceType,
    score: scoreResult.score,
    verdict: scoreResult.verdict,
    auditReport,
    badges: scoreResult.badges,
    discrepancies: scoreResult.discrepancies,
    flaggedIssues: scoreResult.flaggedIssues,
  };

  // 6. Ephemeral persistence in MongoDB with 24-hour TTL
  if (isConnected()) {
    try {
      const auditDoc = new AuthenticityAudit(auditPayload);
      await auditDoc.save();
    } catch (dbErr) {
      console.warn("⚠️ [Authenticity] Audit save notice:", dbErr.message);
    }
  }

  return auditPayload;
}

/**
 * POST /api/documents/verify-authenticity
 * Dedicated endpoint for verifying document authenticity
 */
export async function verifyAuthenticity(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No document file provided. Please upload a PDF or image file.",
      });
    }

    const { buffer, mimetype, originalname } = req.file;
    const sessionId = req.body.sessionId || `sess_${Date.now()}_${nanoid(8)}`;

    console.log(`🔍 [Authenticity] Verifying document "${originalname}" (${(buffer.length / 1024).toFixed(1)} KB)`);

    const auditData = await runFullAuthenticityAudit({
      buffer,
      mimetype,
      originalname,
      sessionId,
    });

    // Zero-Disk Memory Dereferencing
    req.file.buffer = null;

    return res.status(200).json({
      success: true,
      ...auditData,
    });
  } catch (error) {
    if (req.file) req.file.buffer = null;
    next(error);
  }
}

export default { verifyAuthenticity, runFullAuthenticityAudit };
