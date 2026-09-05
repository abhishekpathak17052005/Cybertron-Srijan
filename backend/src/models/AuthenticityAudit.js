import mongoose from "mongoose";

const authenticityAuditSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    sourceType: {
      type: String,
      enum: ["COMPRESSED_SCAN_OR_MESSAGING_APP", "DIGITAL_PDF", "DIRECT_IMAGE"],
      default: "COMPRESSED_SCAN_OR_MESSAGING_APP",
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    verdict: {
      type: String,
      enum: [
        "VERIFIED_VALID",
        "MODERATE_AUTHENTICITY_VERIFIED",
        "CAUTION_INCOMPLETE",
        "HIGH_RISK_TAMPERED",
      ],
      required: true,
    },
    auditReport: {
      forensics: {
        elaPassed: { type: Boolean, default: true },
        tamperAlert: { type: Boolean, default: false },
        avgCompressionDelta: { type: Number, default: 0 },
        maxCompressionDiscrepancy: { type: Number, default: 0 },
        details: { type: String, default: "" },
      },
      statutory: {
        qrDetected: { type: Boolean, default: false },
        registryDomain: { type: String, default: null },
        certificateNumber: { type: String, default: null },
        stampAmountPaid: { type: String, default: null },
        verified: { type: Boolean, default: false },
        details: { type: String, default: "" },
      },
      semantics: {
        chronologySound: { type: Boolean, default: true },
        stampDate: { type: String, default: null },
        executionDate: { type: String, default: null },
        commencementDate: { type: String, default: null },
        partiesMatched: { type: Boolean, default: true },
        witnessesFound: { type: Number, default: 0 },
        details: { type: String, default: "" },
      },
    },
    badges: [
      {
        label: { type: String, required: true },
        status: { type: String, enum: ["PASS", "WARN", "FAIL"], required: true },
        details: { type: String, default: "" },
      },
    ],
    discrepancies: [{ type: String }],
    flaggedIssues: [{ type: String }],
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // 24-hour TTL
    },
  },
  { timestamps: true }
);

export default mongoose.models.AuthenticityAudit || mongoose.model("AuthenticityAudit", authenticityAuditSchema);
