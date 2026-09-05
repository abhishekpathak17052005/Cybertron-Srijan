import dotenv from "dotenv";
dotenv.config();

import sharp from "sharp";
import { runErrorLevelAnalysis } from "./src/services/forensicService.js";
import { extractStatutoryQR } from "./src/services/qrScannerService.js";
import { auditSemanticAuthenticity } from "./src/services/statutoryService.js";
import { calculateAuthenticityScore } from "./src/utils/authenticityScorer.js";
import { runFullAuthenticityAudit } from "./src/controllers/authenticityController.js";

async function runTests() {
  console.log("=================================================");
  console.log("🧪  RUNNING AUTHENTICITY & FORENSIC PIPELINE TESTS");
  console.log("=================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
    }
  }

  // TEST 1: Layer 1 ELA on Uniform Scan
  console.log("🔹 TEST SUITE 1: Layer 1 Forensic & ELA Engine");
  const testCanvas = await sharp({
    create: {
      width: 400,
      height: 400,
      channels: 3,
      background: { r: 245, g: 245, b: 245 },
    },
  })
    .jpeg({ quality: 85 })
    .toBuffer();

  const forensicResult = await runErrorLevelAnalysis(testCanvas, "image/jpeg", "scan_agreement.jpg");
  assert(forensicResult.elaPassed === true, "Uniform image passes ELA check");
  assert(forensicResult.tamperAlert === false, "No tamper alert triggered on uniform scan");
  assert(forensicResult.elaScore >= 80, `ELA score is high (${forensicResult.elaScore})`);
  assert(forensicResult.sourceType === "COMPRESSED_SCAN_OR_MESSAGING_APP" || forensicResult.sourceType === "DIRECT_IMAGE", "Source type classified");

  // TEST 1b: Digital PDF baseline
  const fakePdf = Buffer.concat([
    Buffer.from("%PDF-1.4\n/Type /Font /Subtype /Type1\nstream\nq 1 0 0 1 0 0 cm\nendstream\n%%EOF"),
  ]);
  const pdfForensic = await runErrorLevelAnalysis(fakePdf, "application/pdf", "lease.pdf");
  assert(pdfForensic.sourceType === "DIGITAL_PDF", "PDF recognized as DIGITAL_PDF");
  assert(pdfForensic.elaPassed === true, "Digital PDF passes stream integrity check");

  // TEST 2: Layer 2 Statutory & e-Stamp Extractor
  console.log("\n🔹 TEST SUITE 2: Layer 2 Statutory & e-Stamp Scanner");
  const sampleEStampText = `
    GOVERNMENT OF MAHARASHTRA
    e-Stamp Certificate No: IN-MH90283746192837
    Certificate Issued Date: 12-Feb-2026
    Purchased By: RAKESH SHARMA
    Description of Document: Article 36(a) Leave and License Agreement
    Consideration Price: Rs. 0
    Stamp Duty Paid: Rs. 500
    GRAS Reference: GRN-2026-MH-10293847
    Verify at: gras.mahakosh.gov.in / stockholding.com
  `;

  const statutoryResult = await extractStatutoryQR(Buffer.from(""), "", "", sampleEStampText);
  assert(statutoryResult.verified === true, "Statutory e-Stamp certificate verified via text recognition");
  assert(statutoryResult.certificateNumber === "IN-MH90283746192837", `Certificate extracted correctly: ${statutoryResult.certificateNumber}`);
  assert(
    statutoryResult.registryDomain === "stockholding.com" || statutoryResult.registryDomain === "mahakosh.gov.in",
    `Registry domain identified: ${statutoryResult.registryDomain}`
  );
  assert(statutoryResult.stampAmountPaid === "₹500", `Duty amount identified: ${statutoryResult.stampAmountPaid}`);

  // TEST 3: Layer 3 Semantic & Chronology Auditor (Sound Sequence)
  console.log("\n🔹 TEST SUITE 3: Layer 3 Semantic & Chronology Auditor");
  const contractValidText = `
    LEAVE AND LICENSE AGREEMENT
    This Agreement is made and executed on this 15th day of February 2026.
    BETWEEN Mr. Rakesh Sharma, hereinafter called the LESSOR / LICENSOR (Party 1)
    AND Ms. Priya Nair, hereinafter called the LESSEE / LICENSEE (Party 2).
    WHEREAS the Licensor has purchased stamp duty under e-Stamp Cert IN-MH90283746192837 dated 12/02/2026.
    The term of license shall be 11 months commencing from 01/03/2026.
    IN WITNESS WHEREOF the parties have set their hands:
    Party 1: Rakesh Sharma (Signed)
    Party 2: Priya Nair (Signed)
    WITNESSES:
    1. Witness 1: Amit Patil, Pune
    2. Witness 2: Sneha Rao, Pune
  `;

  const semanticValid = await auditSemanticAuthenticity(contractValidText, statutoryResult);
  assert(semanticValid.chronologyCheck.isChronologicallySound === true, "Sound chronology passes (Stamp: 12-Feb <= Exec: 15-Feb <= Comm: 01-Mar)");
  assert(semanticValid.executionHealth.witnessCount >= 2, "Witness check confirms at least 2 witnesses");

  // TEST 4: Chronology Anomaly Detection (Stamp post-dating Execution)
  const contractFraudText = `
    LEAVE AND LICENSE AGREEMENT
    This Agreement is made and executed on this 05th day of February 2026.
    stamp duty paid on: 28/02/2026.
    WITNESSES:
    1. Witness 1
  `;
  const semanticAnomaly = await auditSemanticAuthenticity(contractFraudText, {});
  assert(semanticAnomaly.chronologyCheck.isChronologicallySound === false, "Fraudulent post-dated stamp flagged as anomaly");

  // TEST 5: Composite Authenticity Scorer
  console.log("\n🔹 TEST SUITE 4: Composite Authenticity Scorer & Badges");
  const scoreValid = calculateAuthenticityScore(forensicResult, statutoryResult, semanticValid);
  assert(scoreValid.score >= 70, `Composite score is high for genuine document: ${scoreValid.score}`);
  assert(
    scoreValid.verdict === "VERIFIED_VALID" || scoreValid.verdict === "MODERATE_AUTHENTICITY_VERIFIED",
    `Verdict is verified: ${scoreValid.verdict}`
  );
  assert(scoreValid.badges.length === 4, `All 4 standard verification badges generated (count: ${scoreValid.badges.length})`);
  assert(scoreValid.badges[0].label === "e-Stamp Certificate Detected" || scoreValid.badges[0].label === "e-Stamp QR Verified", "Badge 1 is e-Stamp");
  assert(scoreValid.badges[1].label.includes("Integrity"), "Badge 2 is Integrity");
  assert(scoreValid.badges[2].label === "Chronological Sequence", "Badge 3 is Chronology");
  assert(scoreValid.badges[3].label === "Witness Verification", "Badge 4 is Witness");

  // TEST 5b: Tamper Score Cap
  const tamperedForensic = { ...forensicResult, tamperAlert: true, maxCompressionDiscrepancy: 48 };
  const scoreTampered = calculateAuthenticityScore(tamperedForensic, statutoryResult, semanticValid);
  assert(scoreTampered.score <= 39, `Tampered document score strictly capped <= 39: ${scoreTampered.score}`);
  assert(scoreTampered.verdict === "HIGH_RISK_TAMPERED", `Tampered verdict is HIGH_RISK_TAMPERED: ${scoreTampered.verdict}`);

  // TEST 6: Full End-to-End Orchestrator
  console.log("\n🔹 TEST SUITE 5: Full End-to-End Authenticity Orchestrator");
  const fullAudit = await runFullAuthenticityAudit({
    buffer: testCanvas,
    mimetype: "image/jpeg",
    originalname: "rental_agreement_scan.jpg",
    text: contractValidText,
  });

  assert(fullAudit.sessionId.startsWith("sess_"), `Session ID generated: ${fullAudit.sessionId}`);
  assert(typeof fullAudit.score === "number", `Audit score returned: ${fullAudit.score}`);
  assert(fullAudit.auditReport.forensics.elaPassed === true, "Audit report forensics populated");
  assert(fullAudit.auditReport.statutory.verified === true, "Audit report statutory populated");
  assert(fullAudit.auditReport.semantics.chronologySound === true, "Audit report semantics populated");

  console.log("\n=================================================");
  console.log(`🏁  SUMMARY: ${passed} / ${total} TESTS PASSED (${((passed / total) * 100).toFixed(0)}%)`);
  console.log("=================================================");

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
