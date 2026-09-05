import mongoose from "mongoose";

const vectorClauseSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    documentType: {
      type: String,
      default: "Contract",
    },
    clauseId: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    clauseText: {
      type: String,
      required: true,
    },
    pageNumber: {
      type: Number,
      default: 1,
    },
    embedding: {
      type: [Number],
      required: true,
    },
    metadata: {
      category: {
        type: String,
        default: "General",
      },
      riskLevel: {
        type: String,
        enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        default: "LOW",
      },
      score: {
        type: Number,
        default: 0,
      },
      financials: {
        isExplicit: { type: Boolean, default: false },
        statedAmount: { type: String, default: null },
        contingentPenalty: { type: String, default: null },
      },
      obligations: {
        assignedTo: {
          type: String,
          default: "None",
        },
        action: {
          type: String,
          default: "",
        },
      },
      connectedClauses: {
        type: [String],
        default: [],
      },
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 86400, // 24-hour TTL auto-expiration
    },
  },
  { timestamps: true }
);

// Compound index for fast retrieval of specific clauses within a session
vectorClauseSchema.index({ sessionId: 1, clauseId: 1 });

export const VectorClause = mongoose.model("VectorClause", vectorClauseSchema, "document_vectors");
export default VectorClause;
