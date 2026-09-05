import React, { createContext, useContext, useEffect, useState } from "react";
import api, { analyzeDocument, queryChat, getTasks, toggleTask, createTask, getDocumentSession } from "../services/api";

export interface ClauseItem {
  id: string;
  clauseId: string;
  title: string;
  category: string;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  score: number;
  page: string;
  text: string;
  plainLanguage?: string;
  connectedClauses: string[];
  financials?: {
    isExplicit?: boolean;
    statedAmount?: string | null;
    contingentPenalty?: string | null;
  };
  obligations?: {
    assignedTo?: string;
    action?: string;
  };
}

export interface TaskItem {
  id: string;
  title: string;
  clause: string;
  date: string;
  time: string;
  impact: string;
  tone: "coral" | "amber" | "lime";
  status: "PENDING" | "COMPLETED" | "SNOOZED" | "SCHEDULED";
}

export interface DAGNode {
  id: string;
  label?: string;
  title: string;
  risk?: string;
  category?: string;
  tone: "coral" | "amber" | "lime" | "neutral";
  x?: string;
  y?: string;
}

export interface DAGEdge {
  source: string;
  target: string;
  relation: string;
  type?: "solid" | "dashed";
}

export interface AuthenticityBadge {
  label: string;
  status: "PASS" | "WARN" | "FAIL";
  details: string;
}

export interface AuthenticityAudit {
  sessionId?: string;
  fileName?: string;
  sourceType: "COMPRESSED_SCAN_OR_MESSAGING_APP" | "DIGITAL_PDF" | "DIRECT_IMAGE";
  score: number;
  verdict: "VERIFIED_VALID" | "MODERATE_AUTHENTICITY_VERIFIED" | "CAUTION_INCOMPLETE" | "HIGH_RISK_TAMPERED";
  auditReport: {
    forensics: {
      elaPassed: boolean;
      tamperAlert: boolean;
      avgCompressionDelta: number;
      maxCompressionDiscrepancy: number;
      details: string;
    };
    statutory: {
      qrDetected: boolean;
      registryDomain: string | null;
      certificateNumber: string | null;
      stampAmountPaid: string | null;
      verified: boolean;
      details: string;
    };
    semantics: {
      chronologySound: boolean;
      stampDate: string | null;
      executionDate: string | null;
      commencementDate: string | null;
      partiesMatched: boolean;
      witnessesFound: number;
      details: string;
    };
  };
  badges: AuthenticityBadge[];
  discrepancies: string[];
  flaggedIssues?: string[];
}

export interface DocumentData {
  documentName: string;
  documentType: string;
  sessionId: string;
  authenticityAudit?: AuthenticityAudit;
  summary: {
    documentType: string;
    fairnessScore: number;
    bias: string;
    clauseCount: number;
    executiveSummary?: string;
  };
  riskScorecard: {
    overallScore: number;
    verdict: string;
    headline?: string;
    breakdown: {
      termination: number;
      financial: number;
      liability: number;
      deposit: number;
    };
  };
  financialLedger: {
    fixedCommitments: Array<{
      item: string;
      frequency: string;
      amount: string;
      clauseRef: string;
      page?: number;
    }>;
    contingentLiabilities: Array<{
      item: string;
      amount: string;
      clauseRef: string;
      trigger: string;
      page?: number;
    }>;
  };
  obligations: {
    user: Array<{
      action: string;
      clauseRef: string;
      detail: string;
      tone?: string;
    }>;
    counterparty: Array<{
      action: string;
      clauseRef: string;
      detail: string;
      isWarning?: boolean;
    }>;
  };
  clauses: ClauseItem[];
  dag: {
    nodes: DAGNode[];
    edges: DAGEdge[];
  };
  tasks: TaskItem[];
}

// Default initial state
const defaultDemoData: DocumentData = {
  documentName: "Residential Rental Agreement",
  documentType: "Residential Rental Agreement",
  sessionId: "sess_demo_default",
  authenticityAudit: {
    sessionId: "sess_demo_default",
    fileName: "Residential Rental Agreement",
    sourceType: "COMPRESSED_SCAN_OR_MESSAGING_APP",
    score: 88,
    verdict: "MODERATE_AUTHENTICITY_VERIFIED",
    auditReport: {
      forensics: {
        elaPassed: true,
        tamperAlert: false,
        avgCompressionDelta: 4.12,
        maxCompressionDiscrepancy: 9.8,
        details: "Uniform ELA profile across clauses with typical mobile messaging compression.",
      },
      statutory: {
        qrDetected: true,
        registryDomain: "gras.mahakosh.gov.in",
        certificateNumber: "IN-MH90283746192837",
        stampAmountPaid: "₹500",
        verified: true,
        details: "StockHolding / GRAS e-Stamp registered under Article 36(a).",
      },
      semantics: {
        chronologySound: true,
        stampDate: "2026-02-12",
        executionDate: "2026-02-15",
        commencementDate: "2026-03-01",
        partiesMatched: true,
        witnessesFound: 2,
        details: "Stamp purchase precedes execution date. 2 witness attestations verified.",
      },
    },
    badges: [
      { label: "e-Stamp QR Verified", status: "PASS", details: "StockHolding Corp Cert #IN-MH90283746192837" },
      { label: "Image Compression Integrity", status: "PASS", details: "Uniform ELA profile across clauses" },
      { label: "Chronological Sequence", status: "PASS", details: "Stamp Date (12/02/26) precedes Signing (15/02/26)" },
      { label: "Witness Verification", status: "PASS", details: "2 independent witnesses attested" },
    ],
    discrepancies: [],
    flaggedIssues: ["EXIF metadata stripped (typical for messaging app transfer)"],
  },
  summary: {
    documentType: "Residential Rental Agreement",
    fairnessScore: 72,
    bias: "Landlord-biased · moderate",
    clauseCount: 24,
    executiveSummary: "Your agreement has been translated into decision-ready intelligence.",
  },
  riskScorecard: {
    overallScore: 68,
    verdict: "Elevated exposure",
    headline: "Three clauses need your attention before the next renewal window.",
    breakdown: {
      termination: 82,
      financial: 74,
      liability: 48,
      deposit: 31,
    },
  },
  financialLedger: {
    fixedCommitments: [
      { item: "Monthly rent", frequency: "Monthly", amount: "₹25,000", clauseRef: "Clause 04 · p. 2" },
      { item: "Security deposit", frequency: "One-time", amount: "₹25,000", clauseRef: "Clause 06 · p. 3" },
    ],
    contingentLiabilities: [
      { item: "Early exit penalty", amount: "₹20,000", clauseRef: "Clause 21 · p. 8", trigger: "Triggered if 60-day notice is missed" },
    ],
  },
  obligations: {
    user: [
      { action: "60-day written notice", clauseRef: "Clause 12 · before exit", detail: "Required prior to early lease termination", tone: "coral" },
      { action: "₹20,000 exit fee", clauseRef: "Clause 21 · if early", detail: "Assessed if early exit without approved cause", tone: "amber" },
      { action: "Monthly rent · ₹25,000", clauseRef: "Clause 04 · recurring", detail: "Due on or before the 5th of each month", tone: "lime" },
    ],
    counterparty: [
      { action: "Maintain premises", clauseRef: "Clause 09", detail: "Keep premises in tenantable condition", isWarning: false },
      { action: "Return deposit in 30 days", clauseRef: "Clause 18", detail: "Return deposit post damage inspection", isWarning: false },
      { action: "Unilateral rent revision", clauseRef: "Clause 07", detail: "Permitted with notice on renewal", isWarning: true },
    ],
  },
  clauses: [
    {
      id: "CLAUSE 04",
      clauseId: "CLAUSE_04",
      title: "Rent and payment schedule",
      category: "Financial",
      risk: "LOW",
      page: "2",
      score: 22,
      text: "The Tenant shall pay monthly rent of ₹25,000 on or before the fifth day of each calendar month.",
      plainLanguage: "Fixed monthly payment requirement. A 5-day grace period exists before late penalties begin.",
      connectedClauses: ["CLAUSE_05"],
    },
    {
      id: "CLAUSE 06",
      clauseId: "CLAUSE_06",
      title: "Security deposit",
      category: "Deposit",
      risk: "MEDIUM",
      page: "3",
      score: 48,
      text: "The security deposit shall be held by the Landlord and returned subject to deductions permitted under this agreement.",
      plainLanguage: "The deposit return is conditioned on verified structural inspections and zero arrears.",
      connectedClauses: ["CLAUSE_18"],
    },
    {
      id: "CLAUSE 07",
      clauseId: "CLAUSE_07",
      title: "Renewal and continuation",
      category: "Term",
      risk: "MEDIUM",
      page: "4",
      score: 41,
      text: "The agreement may be renewed by mutual written consent at least thirty days before the expiry date.",
      plainLanguage: "Renewal requires mutual agreement and counterparty holds unilateral escalation rights.",
      connectedClauses: ["CLAUSE_12"],
    },
    {
      id: "CLAUSE 12",
      clauseId: "CLAUSE_12",
      title: "Termination and notice period",
      category: "Termination",
      risk: "HIGH",
      page: "5",
      score: 82,
      text: "Either party may terminate this agreement by providing a 60-day written notice to the other party.",
      plainLanguage: "This clause gives either party a defined exit path, but your notice obligation is strict. Missing the 60-day window activates a separate financial penalty.",
      connectedClauses: ["CLAUSE_07", "CLAUSE_18", "CLAUSE_21"],
    },
    {
      id: "CLAUSE 18",
      clauseId: "CLAUSE_18",
      title: "Security deposit deductions",
      category: "Deposit",
      risk: "MEDIUM",
      page: "7",
      score: 57,
      text: "Deductions from the deposit may be made for structural damage, unpaid dues, or restoration beyond ordinary wear.",
      plainLanguage: "Protects tenant against arbitrary deductions for normal wear-and-tear like nail holes.",
      connectedClauses: ["CLAUSE_06", "CLAUSE_21"],
    },
    {
      id: "CLAUSE 21",
      clauseId: "CLAUSE_21",
      title: "Early exit penalty",
      category: "Financial",
      risk: "HIGH",
      page: "8",
      score: 91,
      text: "Early termination without the required notice may result in a penalty equivalent to ₹20,000.",
      plainLanguage: "Liquidated damages clause directly connected to Clause 12. Enforces mandatory exit penalty.",
      connectedClauses: ["CLAUSE_12", "CLAUSE_18"],
    },
    {
      id: "CLAUSE 24",
      clauseId: "CLAUSE_24",
      title: "Dispute resolution",
      category: "Liability",
      risk: "LOW",
      page: "11",
      score: 28,
      text: "Parties shall first attempt to resolve disputes through written communication before escalation.",
      plainLanguage: "Direct resolution attempt required prior to any legal proceedings.",
      connectedClauses: [],
    },
  ],
  dag: {
    nodes: [
      { id: "CLAUSE 04", label: "CLAUSE 04", title: "Rent", risk: "LOW", category: "Financial", tone: "neutral", x: "9%", y: "15%" },
      { id: "CLAUSE 07", label: "CLAUSE 07", title: "Renewal", risk: "MEDIUM", category: "Term", tone: "neutral", x: "9%", y: "62%" },
      { id: "CLAUSE 12", label: "CLAUSE 12", title: "Termination", risk: "HIGH", category: "Termination", tone: "coral", x: "39%", y: "34%" },
      { id: "CLAUSE 18", label: "CLAUSE 18", title: "Deposit", risk: "MEDIUM", category: "Deposit", tone: "amber", x: "72%", y: "13%" },
      { id: "CLAUSE 21", label: "CLAUSE 21", title: "Penalty", risk: "HIGH", category: "Financial", tone: "coral", x: "72%", y: "61%" },
      { id: "CLAUSE 24", label: "CLAUSE 24", title: "Disputes", risk: "LOW", category: "Liability", tone: "lime", x: "39%", y: "78%" },
    ],
    edges: [
      { source: "CLAUSE 07", target: "CLAUSE 12", relation: "CONDITIONS", type: "solid" },
      { source: "CLAUSE 12", target: "CLAUSE 18", relation: "DEDUCTS", type: "solid" },
      { source: "CLAUSE 12", target: "CLAUSE 21", relation: "TRIGGERS", type: "solid" },
      { source: "CLAUSE 07", target: "CLAUSE 21", relation: "DEPENDS", type: "dashed" },
    ],
  },
  tasks: [
    {
      id: "demo_1",
      title: "Serve 60-day termination notice",
      clause: "Clause 12 · Page 5",
      date: "30 JAN 2027",
      time: "18:30 IST",
      impact: "₹20,000 penalty if missed",
      tone: "coral",
      status: "PENDING",
    },
    {
      id: "demo_2",
      title: "Confirm renewal decision",
      clause: "Clause 07 · Page 4",
      date: "01 DEC 2026",
      time: "09:00 IST",
      impact: "Renewal window opens",
      tone: "amber",
      status: "PENDING",
    },
    {
      id: "demo_3",
      title: "Request deposit return",
      clause: "Clause 18 · Page 7",
      date: "01 MAR 2027",
      time: "10:00 IST",
      impact: "₹25,000 deposit recovery",
      tone: "lime",
      status: "SCHEDULED",
    },
  ],
};

interface DocumentContextType {
  documentData: DocumentData;
  sessionId: string;
  isAnalyzing: boolean;
  uploadProgress: number;
  uploadStage: string;
  uploadError: string | null;
  tasks: TaskItem[];
  uploadDocument: (file: File, email?: string) => Promise<boolean>;
  verifyDocumentAuthenticity: (file: File) => Promise<AuthenticityAudit | null>;
  askCopilot: (question: string) => Promise<{ answer: string; citations: any[]; connectedClauses: string[] }>;
  toggleTaskStatus: (taskId: string) => Promise<void>;
  addNewTask: (title: string, deadline: string, clauseRef?: string) => Promise<void>;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documentData, setDocumentData] = useState<DocumentData>(() => {
    const cached = sessionStorage.getItem("legallens_active_doc");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }
    return defaultDemoData;
  });

  const [sessionId, setSessionId] = useState<string>(() => documentData.sessionId || "sess_demo");
  const [tasks, setTasks] = useState<TaskItem[]>(() => documentData.tasks || []);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Sync tasks from backend on mount
  useEffect(() => {
    getTasks(sessionId)
      .then((res) => {
        if (res.success && res.tasks && res.tasks.length > 0) {
          setTasks(res.tasks);
        }
      })
      .catch(() => {});
  }, [sessionId]);

  const uploadDocument = async (file: File, email?: string): Promise<boolean> => {
    setIsAnalyzing(true);
    setUploadProgress(10);
    setUploadStage("Allocating RAM buffer (Zero-Disk privacy)...");
    setUploadError(null);

    try {
      const stepTimer1 = setTimeout(() => {
        setUploadProgress(40);
        setUploadStage("Gemini 3.5 Flash extracting structured clauses & risk...");
      }, 1500);

      const stepTimer2 = setTimeout(() => {
        setUploadProgress(75);
        setUploadStage("Generating 768-dim vectors & building dependency DAG...");
      }, 3500);

      const res = await analyzeDocument(file, email, (pct) => {
        if (pct < 30) setUploadProgress(pct);
      });

      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);

      setUploadProgress(95);
      setUploadStage("Scheduling proactive deadline reminders...");

      if (res.success) {
        // Layout positions for graph nodes
        const rawNodes: DAGNode[] = (res.dag?.nodes || []).map((node: any, idx: number) => {
          const xPercent = 10 + (idx % 3) * 35;
          const yPercent = 15 + Math.floor(idx / 3) * 38;
          return {
            id: node.id,
            label: node.label || node.id,
            title: node.title || node.label || node.id,
            risk: node.risk || "LOW",
            category: node.category || "General",
            tone: node.tone || (node.risk === "HIGH" ? "coral" : node.risk === "MEDIUM" ? "amber" : "neutral"),
            x: `${xPercent}%`,
            y: `${yPercent}%`,
          };
        });

        const newDoc: DocumentData = {
          documentName: res.documentName || file.name,
          documentType: res.documentType || "Analyzed Contract",
          sessionId: res.sessionId,
          authenticityAudit: res.authenticityAudit || documentData.authenticityAudit,
          summary: res.summary,
          riskScorecard: res.riskScorecard,
          financialLedger: res.financialLedger,
          obligations: res.obligations,
          clauses: (res.clauses || []).map((c: any) => ({
            id: c.clauseId || c.id,
            clauseId: c.clauseId || c.id,
            title: c.title,
            category: c.category || "General",
            risk: c.risk || "LOW",
            score: c.score || 30,
            page: c.page || "1",
            text: c.text || "",
            plainLanguage: c.plainLanguage || "",
            connectedClauses: c.connectedClauses || [],
          })),
          dag: {
            nodes: rawNodes,
            edges: res.dag?.edges || [],
          },
          tasks: res.tasks || [],
        };

        setDocumentData(newDoc);
        setSessionId(res.sessionId);
        setTasks(res.tasks || []);
        sessionStorage.setItem("legallens_active_doc", JSON.stringify(newDoc));

        setUploadProgress(100);
        setUploadStage("Contract successfully mapped!");
        setIsAnalyzing(false);
        return true;
      } else {
        throw new Error(res.error || "Analysis failed");
      }
    } catch (err: any) {
      console.error(err);
      setUploadError(err.message || "Failed to analyze document");
      setIsAnalyzing(false);
      return false;
    }
  };

  const verifyDocumentAuthenticity = async (file: File): Promise<AuthenticityAudit | null> => {
    try {
      const res = await api.verifyAuthenticity(file, sessionId);
      if (res.success) {
        const updated: DocumentData = {
          ...documentData,
          authenticityAudit: res,
        };
        setDocumentData(updated);
        sessionStorage.setItem("legallens_active_doc", JSON.stringify(updated));
        return res;
      }
      return null;
    } catch (err: any) {
      console.error("Failed to verify document authenticity:", err);
      return null;
    }
  };

  const askCopilot = async (question: string) => {
    return await queryChat(sessionId, question);
  };

  const toggleTaskStatus = async (taskId: string) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, status: t.status === "COMPLETED" ? "PENDING" : "COMPLETED" }
          : t
      )
    );

    try {
      await toggleTask(taskId);
    } catch (err) {
      console.warn("Failed to toggle task:", err);
    }
  };

  const addNewTask = async (title: string, deadline: string, clauseRef?: string) => {
    const res = await createTask({
      sessionId,
      title,
      deadline,
      clauseRef,
    });
    if (res.success && res.task) {
      setTasks((prev) => [res.task, ...prev]);
    }
  };

  return (
    <DocumentContext.Provider
      value={{
        documentData,
        sessionId,
        isAnalyzing,
        uploadProgress,
        uploadStage,
        uploadError,
        tasks,
        uploadDocument,
        verifyDocumentAuthenticity,
        askCopilot,
        toggleTaskStatus,
        addNewTask,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
};

export function useDocument() {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error("useDocument must be used within a DocumentProvider");
  }
  return context;
}

export default DocumentContext;
