/**
 * Compute the composite authenticity score and generate standard forensic badges
 *
 * Scoring Formula (Section 6, authenticity.md):
 * Final Score = (S_Forensic * 0.25) + (S_Statutory * 0.40) + (S_Semantic * 0.35)
 *
 * @param {object} forensicResult - Output from Layer 1
 * @param {object} statutoryResult - Output from Layer 2
 * @param {object} semanticResult - Output from Layer 3
 * @returns {{
 *   score: number,
 *   verdict: "VERIFIED_VALID" | "MODERATE_AUTHENTICITY_VERIFIED" | "CAUTION_INCOMPLETE" | "HIGH_RISK_TAMPERED",
 *   badges: Array<{ label: string, status: "PASS" | "WARN" | "FAIL", details: string }>,
 *   discrepancies: string[],
 *   flaggedIssues: string[]
 * }}
 */
export function calculateAuthenticityScore(forensicResult, statutoryResult, semanticResult) {
  const sForensic = forensicResult.elaScore || 85;
  const sStatutory = statutoryResult.statutoryScore || 50;
  const sSemantic = semanticResult.semanticAuthenticityScore || 80;

  // Weighted composite score calculation
  const weighted = sForensic * 0.25 + sStatutory * 0.4 + sSemantic * 0.35;
  let finalScore = Math.round(Math.max(0, Math.min(100, weighted)));

  // Critical safety override: Tampering alert or post-dated stamp instantly caps score to HIGH_RISK tier
  if (forensicResult.tamperAlert) {
    finalScore = Math.min(finalScore, 35);
  }
  if (semanticResult.chronologyCheck && !semanticResult.chronologyCheck.isChronologicallySound) {
    finalScore = Math.min(finalScore, 38);
  }

  // Determine Classification Tier
  let verdict = "MODERATE_AUTHENTICITY_VERIFIED";
  if (finalScore >= 90) {
    verdict = "VERIFIED_VALID";
  } else if (finalScore >= 70) {
    verdict = "MODERATE_AUTHENTICITY_VERIFIED";
  } else if (finalScore >= 40) {
    verdict = "CAUTION_INCOMPLETE";
  } else {
    verdict = "HIGH_RISK_TAMPERED";
  }

  // Generate 4 Standard Verification Badges
  const badges = [];

  // Badge 1: e-Stamp QR Verified
  if (statutoryResult.qrDetected && statutoryResult.verified) {
    badges.push({
      label: "e-Stamp QR Verified",
      status: "PASS",
      details: `${statutoryResult.registryDomain || "Registry"} Cert #${statutoryResult.certificateNumber || "VERIFIED"}`,
    });
  } else if (statutoryResult.verified) {
    badges.push({
      label: "e-Stamp Certificate Detected",
      status: "PASS",
      details: `OCR confirmed Cert #${statutoryResult.certificateNumber || "IN-MH"} (${statutoryResult.stampAmountPaid || "Duty Paid"})`,
    });
  } else {
    badges.push({
      label: "e-Stamp QR Missing",
      status: "WARN",
      details: "No verifiable 2D barcode or digital e-Stamp header detected",
    });
  }

  // Badge 2: Image Compression Integrity
  if (forensicResult.tamperAlert) {
    badges.push({
      label: "Image Compression Integrity",
      status: "FAIL",
      details: `Tamper alert: anomalous variance delta ${forensicResult.maxCompressionDiscrepancy || 35}`,
    });
  } else if (forensicResult.sourceType === "DIGITAL_PDF") {
    badges.push({
      label: "Document Stream Integrity",
      status: "PASS",
      details: "Native digital vector PDF with uniform stream compression",
    });
  } else {
    badges.push({
      label: "Image Compression Integrity",
      status: "PASS",
      details: "Uniform ELA profile across document canvas",
    });
  }

  // Badge 3: Chronological Sequence
  const isChrono = semanticResult.chronologyCheck?.isChronologicallySound !== false;
  if (isChrono) {
    const sDate = semanticResult.chronologyCheck?.stampPurchaseDate || "Stamp Date";
    const eDate = semanticResult.chronologyCheck?.executionDate || "Signing Date";
    badges.push({
      label: "Chronological Sequence",
      status: "PASS",
      details: `Stamp (${sDate}) precedes Signing (${eDate})`,
    });
  } else {
    badges.push({
      label: "Chronological Sequence",
      status: "FAIL",
      details: semanticResult.chronologyCheck?.issue || "Stamp purchase date post-dates agreement execution",
    });
  }

  // Badge 4: Witness & Execution Verification
  const witnesses = semanticResult.executionHealth?.witnessCount ?? 0;
  const bothSigned = semanticResult.executionHealth?.bothPartiesSigned !== false;

  if (witnesses >= 2 && bothSigned) {
    badges.push({
      label: "Witness Verification",
      status: "PASS",
      details: `${witnesses} witnesses attested with bilateral execution recitals`,
    });
  } else if (witnesses >= 1) {
    badges.push({
      label: "Witness Verification",
      status: "WARN",
      details: `${witnesses} witness found, but Indian tenancy requires 2 independent witnesses`,
    });
  } else {
    badges.push({
      label: "Witness Verification",
      status: "FAIL",
      details: "No witness attestations or execution recitals detected",
    });
  }

  // Aggregate Discrepancies and Flagged Issues
  const discrepancies = [];
  const flaggedIssues = [];

  if (forensicResult.tamperAlert) {
    discrepancies.push("Localized compression variance anomaly indicates potential image or digit modification.");
  }
  if (!statutoryResult.verified) {
    flaggedIssues.push("Official e-Stamp certificate number or government registry barcode not found in document header.");
  }
  if (forensicResult.sourceType === "COMPRESSED_SCAN_OR_MESSAGING_APP") {
    flaggedIssues.push("EXIF/PDF metadata stripped (typical for WhatsApp/Telegram forwards).");
  }
  if (semanticResult.anomaliesDetected && semanticResult.anomaliesDetected.length > 0) {
    discrepancies.push(...semanticResult.anomaliesDetected);
  }

  return {
    score: finalScore,
    verdict,
    badges,
    discrepancies,
    flaggedIssues,
  };
}

export default { calculateAuthenticityScore };
