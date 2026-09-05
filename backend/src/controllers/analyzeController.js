import { nanoid } from "nanoid";
import { extractDocumentContent } from "../utils/ocrCleaner.js";
import geminiService from "../services/geminiService.js";
import vectorService from "../services/vectorService.js";
import { generateActionToken } from "../utils/tokenGenerator.js";
import TaskReminder from "../models/TaskReminder.js";
import { scheduleTaskReminders } from "../config/agenda.js";
import { isConnected } from "../config/db.js";
import { runFullAuthenticityAudit } from "./authenticityController.js";

// Session cache to support fast tab switching and session sharing
const sessionCache = new Map();

/**
 * POST /api/documents/analyze
 * Ingest document in-memory, extract intelligence, store vectors, schedule tasks, wipe buffer
 */
export async function analyzeDocument(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No document file provided. Please upload a PDF, DOCX, or image file.",
      });
    }

    const { originalname, mimetype, buffer } = req.file;
    const recipientEmail = req.body.recipientEmail || process.env.SMTP_USER || "user@example.com";
    const sessionId = `sess_${Date.now()}_${nanoid(8)}`;

    console.log(`📥 [Analyze] Ingesting document "${originalname}" (${(buffer.length / 1024).toFixed(1)} KB) in RAM`);

    // 1. In-memory content extraction
    const extraction = await extractDocumentContent(buffer, mimetype, originalname);

    // 2. Intelligence extraction via Gemini + Authenticity Forensic Audit in parallel
    const [report, authenticityAudit] = await Promise.all([
      geminiService.analyzeDocument({
        text: extraction.text,
        isImage: extraction.isImage,
        imageBuffer: extraction.imageBuffer,
        mimeType: extraction.mimeType,
        filename: originalname,
        pageCount: extraction.pageCount,
      }),
      runFullAuthenticityAudit({
        buffer,
        mimetype,
        originalname,
        text: extraction.text,
        sessionId,
      }),
    ]);

    // 3. Batch generate vector embeddings for clauses
    const clausesToEmbed = report.clauses || [];
    console.log(`🧠 [Analyze] Generating 768-dim embeddings for ${clausesToEmbed.length} clauses...`);
    const embeddings = await geminiService.generateBatchEmbeddings(clausesToEmbed);

    const clausesWithEmbeddings = clausesToEmbed.map((c, i) => ({
      ...c,
      documentType: report.documentType,
      embedding: embeddings[i],
    }));

    // 4. Store clause vectors with 24-hr TTL
    await vectorService.storeClauses(sessionId, clausesWithEmbeddings);

    // 5. Schedule automated email tasks (T-72h, T-24h, T-5h)
    const savedTasks = [];
    const rawTasks = report.tasks || [];

    for (const t of rawTasks) {
      const deadlineDate = new Date(t.deadline || Date.now() + 14 * 24 * 60 * 60 * 1000);
      const tempId = nanoid(16);

      const doneToken = generateActionToken(tempId, "done");
      const snoozeToken = generateActionToken(tempId, "snooze");

      const tTime = deadlineDate.getTime();
      const schedule = [
        {
          type: "3_DAYS_BEFORE",
          runAt: new Date(tTime - 72 * 60 * 60 * 1000),
          sent: false,
        },
        {
          type: "1_DAY_BEFORE",
          runAt: new Date(tTime - 24 * 60 * 60 * 1000),
          sent: false,
        },
        {
          type: "5_HOURS_BEFORE",
          runAt: new Date(tTime - 5 * 60 * 60 * 1000),
          sent: false,
        },
      ];

      const taskDocData = {
        sessionId,
        recipientEmail,
        documentName: report.documentType || originalname,
        task: {
          title: t.title,
          clauseRef: t.clauseRef || "",
          description: t.description || "",
          deadline: deadlineDate,
          financialImpact: t.financialImpact || "",
        },
        schedule,
        status: "PENDING",
        actionTokens: {
          doneToken,
          snoozeToken,
        },
      };

      if (isConnected()) {
        try {
          const taskDoc = new TaskReminder(taskDocData);
          // Sync real _id to tokens
          taskDoc.actionTokens.doneToken = generateActionToken(taskDoc._id.toString(), "done");
          taskDoc.actionTokens.snoozeToken = generateActionToken(taskDoc._id.toString(), "snooze");
          await taskDoc.save();
          await scheduleTaskReminders(taskDoc);
          savedTasks.push(taskDoc);
        } catch (dbErr) {
          console.warn("⚠️ [Analyze] Task save notice:", dbErr.message);
          savedTasks.push({ ...taskDocData, _id: tempId });
        }
      } else {
        savedTasks.push({ ...taskDocData, _id: tempId });
      }
    }

    // 6. Explicit Memory Dereferencing (Zero-Disk guarantee)
    req.file.buffer = null;

    const responsePayload = {
      success: true,
      sessionId,
      documentName: originalname,
      documentType: report.documentType,
      authenticityAudit,
      summary: {
        documentType: report.documentType,
        fairnessScore: report.fairnessScore,
        bias: report.bias,
        clauseCount: report.clauseCount || clausesToEmbed.length,
        executiveSummary: report.executiveSummary,
      },
      riskScorecard: report.riskScorecard,
      financialLedger: report.financialLedger,
      obligations: report.obligations,
      clauses: clausesWithEmbeddings.map((c) => ({
        id: c.clauseId,
        clauseId: c.clauseId,
        title: c.title,
        category: c.category || c.metadata?.category,
        risk: c.riskLevel || c.metadata?.riskLevel || "LOW",
        score: c.score || c.metadata?.score || 30,
        page: c.pageNumber?.toString() || "1",
        text: c.clauseText,
        plainLanguage: c.plainLanguage,
        connectedClauses: c.connectedClauses || c.metadata?.connectedClauses || [],
        financials: c.financials || c.metadata?.financials,
        obligations: c.obligations || c.metadata?.obligations,
      })),
      dag: report.dag,
      tasks: savedTasks.map((st) => ({
        id: st._id.toString(),
        title: st.task.title,
        clause: st.task.clauseRef,
        date: new Date(st.task.deadline).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).toUpperCase(),
        time: new Date(st.task.deadline).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
        }) + " IST",
        impact: st.task.financialImpact,
        tone: st.task.title.toLowerCase().includes("termination") ? "coral" : "amber",
        status: st.status,
      })),
      tasksDetected: savedTasks.length,
    };

    // Cache session response
    sessionCache.set(sessionId, responsePayload);

    console.log(`✅ [Analyze] Completed analysis for session: ${sessionId} (Zero-disk wiped)`);
    return res.status(200).json(responsePayload);
  } catch (error) {
    // Ensure buffer is dereferenced on error
    if (req.file) req.file.buffer = null;
    next(error);
  }
}

/**
 * GET /api/documents/:sessionId
 * Fetch stored analysis for session
 */
export async function getDocumentSession(req, res) {
  const { sessionId } = req.params;
  const cached = sessionCache.get(sessionId);

  if (cached) {
    return res.json({ success: true, ...cached });
  }

  return res.status(404).json({
    success: false,
    error: "Session expired or not found. LegalLens enforces 24-hour ephemeral expiry.",
  });
}

export default { analyzeDocument, getDocumentSession };
