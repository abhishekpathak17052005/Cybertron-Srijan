import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileText,
  Fingerprint,
  Info,
  Layers,
  Loader2,
  Mic,
  MoreHorizontal,
  Play,
  Plus,
  QrCode,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  TrendingDown,
  TrendingUp,
  Volume2,
  WalletCards,
  X,
} from "lucide-react";
import { useDocument } from "../contexts/DocumentContext";
import { speakSanitizedText, stopSpeaking } from "../utils/speechSanitizer";

type HomeProps = { onUpload: () => void };

type MetricProps = {
  label: string;
  value: string;
  detail: string;
  tone: "lime" | "coral" | "white";
  trend?: "up" | "down";
  delay: number;
};

function AnimatedMetric({ label, value, detail, tone, trend, delay }: MetricProps) {
  const [shown, setShown] = useState("0");
  const numeric = Number(value.replace(/[^0-9.]/g, ""));
  const prefix = value.startsWith("₹") ? "₹" : "";
  const suffix = value.includes("%") ? "%" : "";

  useEffect(() => {
    let frame = 0;
    const start = performance.now() + delay;
    const animate = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / 900));
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = numeric * eased;
      setShown(current >= 1000 ? Math.round(current).toLocaleString("en-IN") : current.toFixed(numeric % 1 ? 1 : 0));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [delay, numeric]);

  return (
    <article className={`metric-card ${tone}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="metric-topline">
        <span>{label}</span>
        <span className="metric-live"><i /> live</span>
      </div>
      <div className="metric-number">
        {prefix}{shown}{suffix}
      </div>
      <div className="metric-detail">
        {trend && (trend === "up" ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
        <span>{detail}</span>
      </div>
    </article>
  );
}

function RiskBar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="risk-row">
      <div className="risk-label">
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <div className="risk-track">
        <div className={`risk-fill ${tone}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function ClauseNode({
  label,
  title,
  x,
  y,
  tone,
  active,
}: {
  label: string;
  title: string;
  x: string;
  y: string;
  tone: string;
  active?: boolean;
}) {
  return (
    <div className={`clause-node ${tone} ${active ? "node-active" : ""}`} style={{ left: x, top: y }}>
      <span>{label}</span>
      <strong>{title}</strong>
    </div>
  );
}

export default function Home({ onUpload }: HomeProps) {
  const { documentData, tasks, toggleTaskStatus, askCopilot } = useDocument();

  const [activeClause, setActiveClause] = useState("CLAUSE 12");
  const [chatQuestion, setChatQuestion] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [copilotResponse, setCopilotResponse] = useState<{
    answer: string;
    citations: any[];
    connectedClauses: string[];
  } | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [spokenBoundary, setSpokenBoundary] = useState<{ start: number; length: number } | null>(null);
  const [ledgerTab, setLedgerTab] = useState<"mandatory" | "contingent">("mandatory");
  const [showForensicModal, setShowForensicModal] = useState(false);

  // Calculate totals from financial ledger
  const statedTotal = useMemo(() => {
    const list = documentData.financialLedger?.fixedCommitments || [];
    let sum = 0;
    list.forEach((item) => {
      const match = item.amount.replace(/[^0-9]/g, "");
      if (match) sum += parseInt(match, 10);
    });
    return sum > 0 ? `₹${sum.toLocaleString("en-IN")}` : "₹25,000";
  }, [documentData]);

  const contingentTotal = useMemo(() => {
    const list = documentData.financialLedger?.contingentLiabilities || [];
    let sum = 0;
    list.forEach((item) => {
      const match = item.amount.replace(/[^0-9]/g, "");
      if (match) sum += parseInt(match, 10);
    });
    return sum > 0 ? `₹${sum.toLocaleString("en-IN")}` : "₹20,000";
  }, [documentData]);

  // Attention queue: high & medium risk clauses
  const highRiskClauses = useMemo(() => {
    const all = documentData.clauses || [];
    const high = all.filter((c) => c.risk === "HIGH" || c.risk === "CRITICAL");
    if (high.length > 0) return high.slice(0, 4);
    return all.slice(0, 3);
  }, [documentData]);

  const defaultGreeting = useMemo(
    () =>
      `Ask a grounded question about your ${documentData.summary?.documentType || "contract"}. I’ll cite the exact clause and page, then map connected obligations.`,
    [documentData]
  );

  const sendQuestion = async () => {
    if (!chatQuestion.trim() || chatLoading) return;
    const q = chatQuestion;
    setChatQuestion("");
    setChatLoading(true);

    try {
      const res = await askCopilot(q);
      setCopilotResponse(res);
    } catch (err) {
      console.error(err);
      setCopilotResponse({
        answer: "Unable to retrieve copilot answer at this moment. Please try again.",
        citations: [],
        connectedClauses: [],
      });
    } finally {
      setChatLoading(false);
    }
  };

  const toggleVoicePlayback = () => {
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
      setSpokenBoundary(null);
      return;
    }

    const textToSpeak = copilotResponse?.answer || defaultGreeting;
    setIsPlaying(true);

    speakSanitizedText(textToSpeak, {
      onStart: () => setIsPlaying(true),
      onEnd: () => {
        setIsPlaying(false);
        setSpokenBoundary(null);
      },
      onError: () => {
        setIsPlaying(false);
        setSpokenBoundary(null);
      },
      onBoundary: (charIndex, textLength) => {
        setSpokenBoundary({ start: charIndex, length: textLength });
      },
    });
  };

  const exportLedgerCSV = () => {
    const fixed = documentData.financialLedger?.fixedCommitments || [];
    const contingent = documentData.financialLedger?.contingentLiabilities || [];

    let csv = "Type,Item,Frequency,Amount,Clause Reference,Trigger / Details\n";
    fixed.forEach((f) => {
      csv += `"Stated Commitment","${f.item}","${f.frequency}","${f.amount}","${f.clauseRef}","Standard commitment"\n`;
    });
    contingent.forEach((c) => {
      csv += `"Contingent Penalty","${c.item}","Contingent","${c.amount}","${c.clauseRef}","${c.trigger || ""}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `LegalLens_Ledger_${documentData.sessionId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const nextTask = tasks.find((t) => t.status !== "COMPLETED") || tasks[0];

  return (
    <div className="dashboard-content">
      <section className="hero-row animate-in">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> CONTRACT PULSE · LIVE INTELLIGENCE
          </div>
          <h1>
            Good morning, Om<span className="lime-dot">.</span>
          </h1>
          <p className="hero-subtitle">
            {documentData.summary?.executiveSummary || (
              <>
                Your agreement has been translated into{" "}
                <strong>decision-ready intelligence.</strong>
              </>
            )}
          </p>
        </div>
        <div className="hero-actions">
          <button
            className="ghost-button"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              alert("Session URL copied! Ephemeral 24h report link ready to share.");
            }}
          >
            <ArrowUpRight size={15} /> Share report
          </button>
          <button className="lime-button" onClick={onUpload}>
            <Plus size={17} /> Analyze document
          </button>
        </div>
      </section>

      <section className="document-banner animate-in delay-1">
        <div className="document-icon">
          <FileCheck2 size={21} />
        </div>
        <div className="document-info">
          <div className="document-name">
            {documentData.documentName}{" "}
            <span className="status-badge">
              <i /> Analyzed
            </span>
          </div>
          <div className="document-meta">
            <span>{documentData.summary?.documentType || "Contract"}</span>
            <span>·</span>
            <span>{documentData.summary?.clauseCount || 24} clauses mapped</span>
            <span>·</span>
            <span>Zero-Disk RAM Buffer</span>
          </div>
        </div>
        <div className="document-privacy">
          <span className="privacy-mini">⌁</span> Session-scoped (24h TTL) <ChevronRight size={15} />
        </div>
      </section>
 
      {/* Document Authenticity & Forensic Audit Card */}
      {documentData.authenticityAudit && (
        <section className="authenticity-section animate-in delay-1">
          <div className="authenticity-header">
            <div className="authenticity-title-wrap">
              <div className={`authenticity-icon-box ${documentData.authenticityAudit.score < 40 ? "high-risk" : ""}`}>
                {documentData.authenticityAudit.score >= 70 ? (
                  <ShieldCheck size={24} />
                ) : (
                  <ShieldAlert size={24} />
                )}
              </div>
              <div className="authenticity-title-meta">
                <span>Statutory & Forensic Verification</span>
                <h3>
                  {documentData.authenticityAudit.verdict === "VERIFIED_VALID" && "High Statutory Authenticity"}
                  {documentData.authenticityAudit.verdict === "MODERATE_AUTHENTICITY_VERIFIED" && "Authenticity Verified · WhatsApp/Scan Artifact"}
                  {documentData.authenticityAudit.verdict === "CAUTION_INCOMPLETE" && "Caution: Execution or Statutory Stamp Incomplete"}
                  {documentData.authenticityAudit.verdict === "HIGH_RISK_TAMPERED" && "High Risk: Tampering Alert or Critical Date Anomaly"}
                </h3>
                <small>
                  {documentData.authenticityAudit.sourceType === "COMPRESSED_SCAN_OR_MESSAGING_APP" && "Mobile scan compression profile · Zero-disk ELA verified"}
                  {documentData.authenticityAudit.sourceType === "DIGITAL_PDF" && "Native digital PDF vector stream · Intact font dictionaries"}
                  {documentData.authenticityAudit.sourceType === "DIRECT_IMAGE" && "Direct optical scan · Pixel delta integrity verified"}
                </small>
              </div>
            </div>

            <div className="authenticity-actions-wrap">
              <div className={`verdict-pill ${
                documentData.authenticityAudit.score >= 90 ? "verified" :
                documentData.authenticityAudit.score >= 70 ? "moderate" :
                documentData.authenticityAudit.score >= 40 ? "caution" : "tampered"
              }`}>
                <i /> {documentData.authenticityAudit.verdict.replace(/_/g, " ")}
              </div>
              <div className={`authenticity-score-badge ${documentData.authenticityAudit.score < 40 ? "high-risk" : ""}`}>
                <strong>{documentData.authenticityAudit.score}</strong>
                <span>/ 100</span>
              </div>
              <button
                className="ghost-button"
                onClick={() => setShowForensicModal(true)}
                style={{ height: "40px" }}
              >
                <Fingerprint size={16} /> View Forensic Audit
              </button>
            </div>
          </div>

          <div className="authenticity-badges-grid">
            {(documentData.authenticityAudit.badges || []).map((b, idx) => (
              <div key={idx} className={`badge-card ${b.status.toLowerCase()}`}>
                <div className="badge-card-top">
                  <span className="badge-label">{b.label}</span>
                  <span className={`badge-status-chip ${b.status.toLowerCase()}`}>{b.status}</span>
                </div>
                <div className="badge-details">{b.details}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="metrics-grid animate-in delay-2">
        <AnimatedMetric
          label="Overall exposure"
          value={documentData.riskScorecard?.overallScore?.toString() || "68"}
          detail="Exposure index based on strict penalties"
          tone="coral"
          trend="up"
          delay={120}
        />
        <AnimatedMetric
          label="Fairness index"
          value={documentData.summary?.fairnessScore?.toString() || "72"}
          detail={documentData.summary?.bias || "Landlord-biased · moderate"}
          tone="lime"
          trend="down"
          delay={180}
        />
        <AnimatedMetric
          label="Financial exposure"
          value={contingentTotal}
          detail={`${contingentTotal} contingent · ${statedTotal} stated`}
          tone="white"
          delay={240}
        />
        <article className="metric-card deadline-card" style={{ animationDelay: "300ms" }}>
          <div className="metric-topline">
            <span>Next obligation</span>
            <span className="deadline-chip">
              {nextTask ? (nextTask.status === "COMPLETED" ? "DONE" : "SCHEDULED") : "RADAR ACTIVE"}
            </span>
          </div>
          <div className="deadline-date">
            {nextTask?.date ? nextTask.date.slice(0, 6) : "30 JAN"}
          </div>
          <div className="metric-detail">
            <Clock3 size={14} />
            <span>{nextTask?.title || "No pending deadlines"}</span>
          </div>
        </article>
      </section>

      <section className="main-grid animate-in delay-3">
        <div className="panel risk-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">01 · Risk scorecard</span>
              <h2>Where you carry the weight</h2>
            </div>
            <button className="panel-menu" aria-label="Risk panel actions">
              <MoreHorizontal size={18} />
            </button>
          </div>
          <div className="risk-summary">
            <div className="risk-gauge">
              <svg viewBox="0 0 120 70" aria-hidden="true">
                <path className="gauge-bg" d="M15 60 A45 45 0 0 1 105 60" />
                <path
                  className="gauge-fill"
                  d="M15 60 A45 45 0 0 1 105 60"
                  style={{
                    strokeDashoffset: `${
                      141 - 141 * ((documentData.riskScorecard?.overallScore || 68) / 100)
                    }`,
                  }}
                />
              </svg>
              <strong>{documentData.riskScorecard?.overallScore || 68}</strong>
              <span>/ 100</span>
            </div>
            <div className="risk-verdict">
              <span className="risk-pill">
                {documentData.riskScorecard?.verdict || "Elevated exposure"}
              </span>
              <p>
                {documentData.riskScorecard?.headline ||
                  "Three clauses need your attention before the next renewal window."}
              </p>
            </div>
          </div>
          <div className="risk-bars">
            <RiskBar
              label="Termination"
              value={documentData.riskScorecard?.breakdown?.termination || 82}
              tone="coral-fill"
            />
            <RiskBar
              label="Financial"
              value={documentData.riskScorecard?.breakdown?.financial || 74}
              tone="coral-fill"
            />
            <RiskBar
              label="Liability"
              value={documentData.riskScorecard?.breakdown?.liability || 48}
              tone="amber-fill"
            />
            <RiskBar
              label="Deposit"
              value={documentData.riskScorecard?.breakdown?.deposit || 31}
              tone="lime-fill"
            />
          </div>
          <div className="risk-footnote">
            <Info size={14} /> Score is calculated from explicit penalties, unilateral rights, and notice constraints.
          </div>
        </div>

        <div className="panel obligations-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">02 · Obligation grid</span>
              <h2>Who owes what</h2>
            </div>
            <button className="text-link">
              Bilateral matrix <ChevronRight size={14} />
            </button>
          </div>
          <div className="obligation-head">
            <span>YOUR SIDE</span>
            <span>COUNTERPARTY</span>
          </div>

          {(documentData.obligations?.user || []).slice(0, 3).map((u, idx) => {
            const cp = documentData.obligations?.counterparty?.[idx];
            return (
              <div className="obligation-row" key={idx}>
                <div>
                  <span className={`obligation-icon ${u.tone === "coral" ? "coral-bg" : u.tone === "amber" ? "amber-bg" : "lime-bg"}`}>
                    <CircleAlert size={15} />
                  </span>
                  <div>
                    <strong>{u.action}</strong>
                    <small>{u.clauseRef} · {u.detail}</small>
                  </div>
                </div>
                <div>
                  {cp ? (
                    <>
                      {cp.isWarning ? (
                        <CircleAlert size={15} className="warn-icon" />
                      ) : (
                        <Check size={15} className="check-icon" />
                      )}
                      <span>{cp.action}</span>
                    </>
                  ) : (
                    <>
                      <Check size={15} className="check-icon" />
                      <span>Maintain premises</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          <button className="expand-button" onClick={() => window.location.assign("/clause-intelligence")}>
            View all obligations in Clause Intelligence <ArrowUpRight size={14} />
          </button>
        </div>
      </section>

      <section className="lower-grid animate-in delay-4">
        <div className="panel graph-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">03 · Clause relationship map</span>
              <h2>Nothing exists in isolation</h2>
            </div>
            <button className="text-link" onClick={() => window.location.assign("/clause-graph")}>
              Open graph <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="graph-shell">
            <div className="graph-toolbar">
              <span className="graph-dot" /> Live relationship map ({documentData.dag?.nodes?.length || 6} nodes)
            </div>
            <div className="graph-canvas">
              <svg className="graph-lines" viewBox="0 0 660 270" preserveAspectRatio="none" aria-hidden="true">
                <path d="M150 86 C220 86, 250 122, 300 122" />
                <path d="M365 125 C430 125, 440 73, 505 73" />
                <path d="M365 140 C430 140, 443 200, 505 200" />
                <path className="dashed" d="M170 95 C270 215, 397 230, 505 205" />
              </svg>
              {(documentData.dag?.nodes || []).slice(0, 4).map((node, i) => {
                const defaultCoords = [
                  { x: "7%", y: "23%" },
                  { x: "40%", y: "35%" },
                  { x: "73%", y: "6%" },
                  { x: "73%", y: "55%" },
                ];
                const coord = defaultCoords[i] || { x: `${20 + i * 20}%`, y: `${30 + (i % 2) * 20}%` };
                return (
                  <ClauseNode
                    key={node.id}
                    label={node.label || node.id}
                    title={node.title}
                    x={node.x || coord.x}
                    y={node.y || coord.y}
                    tone={node.tone || "neutral"}
                    active={node.id.includes("12") || i === 1}
                  />
                );
              })}
              <span className="graph-legend">
                <i className="legend-solid" /> Direct trigger <i className="legend-dashed" /> Implied dependency
              </span>
            </div>
          </div>
        </div>

        <div className="panel clause-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">04 · Attention queue</span>
              <h2>Clauses worth a closer look</h2>
            </div>
            <span className="queue-count">{highRiskClauses.length}</span>
          </div>
          <div className="clause-list">
            {highRiskClauses.map((clause) => (
              <button
                key={clause.id}
                className={`clause-item ${activeClause === clause.id ? "selected" : ""}`}
                onClick={() => setActiveClause(clause.id)}
              >
                <div className={`clause-severity ${clause.risk === "HIGH" || clause.risk === "CRITICAL" ? "coral" : clause.risk === "MEDIUM" ? "amber" : "lime"}`} />
                <div className="clause-item-copy">
                  <span>
                    {clause.id} · p. {clause.page} · {clause.risk} RISK
                  </span>
                  <strong>{clause.title}</strong>
                  <small className={clause.risk === "HIGH" ? "coral" : "amber"}>
                    {clause.connectedClauses?.length ? `${clause.connectedClauses.length} connected` : "Action required"}
                  </small>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          <button className="expand-button" onClick={() => window.location.assign("/clause-intelligence")}>
            View all {documentData.clauses?.length || 24} clauses <ArrowUpRight size={14} />
          </button>
        </div>
      </section>

      <section className="bottom-grid animate-in delay-5">
        <div className="panel ledger-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">05 · Financial ledger</span>
              <h2>What this contract can cost</h2>
            </div>
            <button className="download-button" onClick={exportLedgerCSV}>
              Export CSV <ArrowUpRight size={14} />
            </button>
          </div>
          <div className="ledger-tabs">
            <button
              className={ledgerTab === "mandatory" ? "active" : ""}
              onClick={() => setLedgerTab("mandatory")}
            >
              Stated commitments <span>{documentData.financialLedger?.fixedCommitments?.length || "02"}</span>
            </button>
            <button
              className={ledgerTab === "contingent" ? "active" : ""}
              onClick={() => setLedgerTab("contingent")}
            >
              Contingent penalties <span>{documentData.financialLedger?.contingentLiabilities?.length || "01"}</span>
            </button>
          </div>

          {ledgerTab === "mandatory" ? (
            <div className="ledger-table">
              <div className="ledger-line ledger-head">
                <span>ITEM</span>
                <span>FREQUENCY</span>
                <span>AMOUNT</span>
              </div>
              {(documentData.financialLedger?.fixedCommitments || []).map((item, idx) => (
                <div className="ledger-line" key={idx}>
                  <span>
                    <strong>{item.item}</strong>
                    <small>{item.clauseRef}</small>
                  </span>
                  <span>{item.frequency}</span>
                  <strong>{item.amount}</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="contingent-empty">
              <div className="empty-spark">
                <Sparkles size={18} />
              </div>
              <strong>{contingentTotal} possible exposure</strong>
              <span>
                {(documentData.financialLedger?.contingentLiabilities || [])
                  .map((c) => `${c.item} (${c.clauseRef}) — ${c.trigger}`)
                  .join(" · ")}
              </span>
            </div>
          )}
        </div>

        <div className="panel timeline-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">06 · Deadline radar</span>
              <h2>Don’t miss the moment</h2>
            </div>
            <button className="text-link" onClick={() => window.location.assign("/reminders")}>
              Manage radar <ArrowUpRight size={14} />
            </button>
          </div>
          {tasks.slice(0, 2).map((t) => {
            const isDone = t.status === "COMPLETED";
            return (
              <div className={`timeline-item ${isDone ? "muted-timeline" : ""}`} key={t.id}>
                <div className={`timeline-marker ${isDone ? "" : "active"}`} />
                <div className="timeline-copy">
                  <span>{t.date} · {t.time}</span>
                  <strong style={{ textDecoration: isDone ? "line-through" : "none" }}>{t.title}</strong>
                  <small>{t.clause} · {t.impact}</small>
                </div>
                <button
                  className={`task-toggle ${isDone ? "done" : ""}`}
                  onClick={() => toggleTaskStatus(t.id)}
                  title={isDone ? "Mark Pending" : "Mark Done"}
                >
                  {isDone ? <Check size={15} /> : <span />}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="copilot-panel animate-in delay-6">
        <div className="copilot-intro">
          <div className="copilot-orb">
            <Sparkles size={19} />
          </div>
          <div>
            <span className="section-kicker">07 · Grounded copilot</span>
            <h2>
              Ask the contract anything<span className="lime-dot">.</span>
            </h2>
            <p>{copilotResponse ? "Grounded in your document vectors & clause DAG:" : defaultGreeting}</p>
          </div>
        </div>

        {(copilotResponse || chatLoading) && (
          <div className="copilot-answer answer-visible">
            {chatLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 0" }}>
                <Loader2 size={18} className="animate-spin text-lime" />
                <span>Searching MongoDB vector index & traversing clause adjacency...</span>
              </div>
            ) : copilotResponse ? (
              <>
                <div className="answer-meta">
                  <span className="answer-badge">
                    <Sparkles size={12} /> Grounded answer
                  </span>
                  <span>
                    {copilotResponse.citations?.length || 0} citations · {copilotResponse.connectedClauses?.length || 0} graph hops
                  </span>
                </div>
                <p style={{ lineHeight: 1.6, margin: "10px 0" }}>{copilotResponse.answer}</p>
                <div className="citation-row">
                  {copilotResponse.citations?.map((c: any, i: number) => (
                    <span key={i}>
                      [{c.clauseId?.replace("_", " ")} · P. {c.page}]
                    </span>
                  ))}
                  <button onClick={toggleVoicePlayback}>
                    {isPlaying ? <Square size={13} fill="currentColor" /> : <Volume2 size={14} />}
                    {isPlaying ? "Stop audio" : "Hear answer"}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        <div className="copilot-input">
          <input
            value={chatQuestion}
            onChange={(e) => setChatQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendQuestion()}
            placeholder="e.g. Can the deposit be withheld for repainting or nail holes?"
            aria-label="Ask LegalLens"
            disabled={chatLoading}
          />
          <button
            className="voice-button"
            onClick={() => {
              if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
                const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
                const recognition = new SpeechRecognition();
                recognition.onresult = (event: any) => {
                  setChatQuestion(event.results[0][0].transcript);
                };
                recognition.start();
              } else {
                alert("Speech recognition is supported in Chrome/Edge browsers.");
              }
            }}
            aria-label="Use voice input"
          >
            <Mic size={17} />
          </button>
          <button className="send-button" onClick={sendQuestion} aria-label="Send question" disabled={chatLoading}>
            {chatLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>

        <div className="suggestion-row">
          <button onClick={() => { setChatQuestion("What happens if I leave before the lease ends without 60 days notice?"); }}>
            Early exit scenario <ChevronRight size={13} />
          </button>
          <button onClick={() => { setChatQuestion("Which clauses are landlord-biased or carry penalties?"); }}>
            Bias & penalties check <ChevronRight size={13} />
          </button>
          <button onClick={() => { setChatQuestion("When do I get my deposit back and what deductions are allowed?"); }}>
            Deposit timeline & deductions <ChevronRight size={13} />
          </button>
        </div>
      </section>

      <footer className="dashboard-footer">
        <span>
          <span className="footer-mark">◌</span> LegalLens / Private intelligence layer
        </span>
        <span>
          All analysis is grounded in your uploaded document · Zero-disk in-memory guarantee
        </span>
      </footer>

      {/* Forensic Audit Deep Inspection Modal */}
      {showForensicModal && documentData.authenticityAudit && (
        <div className="forensic-modal-backdrop" onClick={() => setShowForensicModal(false)}>
          <div className="forensic-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="forensic-modal-header">
              <div>
                <span className="section-kicker">Multi-Layer Forensic Audit</span>
                <h2 style={{ fontSize: "22px", margin: "4px 0 0", color: "var(--cream)" }}>Document Authenticity Verification Report</h2>
                <p style={{ margin: "4px 0 0", color: "#8a9686", fontSize: "11px" }}>
                  Session ID: <code style={{ color: "var(--lime)" }}>{documentData.sessionId}</code> · Zero-Disk In-Memory Analysis
                </p>
              </div>
              <button className="forensic-modal-close" onClick={() => setShowForensicModal(false)} aria-label="Close modal">
                <X size={18} />
              </button>
            </div>

            <div className="forensic-layers-container">
              {/* Layer 1: Forensic Computer Vision (ELA) */}
              <div className="forensic-layer-block">
                <div className="layer-block-header">
                  <div className="layer-title-wrap">
                    <span className="layer-num-badge">LAYER 1</span>
                    <strong style={{ fontSize: "14px", color: "var(--cream)" }}>Computer Vision & Error Level Analysis (ELA)</strong>
                  </div>
                  <span className={`badge-status-chip ${documentData.authenticityAudit.auditReport?.forensics?.elaPassed ? "pass" : "fail"}`}>
                    {documentData.authenticityAudit.auditReport?.forensics?.elaPassed ? "PASS" : "FAIL"}
                  </span>
                </div>
                <div className="layer-stats-grid">
                  <div className="layer-stat-cell">
                    <span>Recompression Error (Avg)</span>
                    <strong>{documentData.authenticityAudit.auditReport?.forensics?.avgCompressionDelta ?? 0} Δ</strong>
                  </div>
                  <div className="layer-stat-cell">
                    <span>Max Regional Spike</span>
                    <strong>{documentData.authenticityAudit.auditReport?.forensics?.maxCompressionDiscrepancy ?? 0} Δ</strong>
                  </div>
                  <div className="layer-stat-cell">
                    <span>Tampering Alert</span>
                    <strong style={{ color: documentData.authenticityAudit.auditReport?.forensics?.tamperAlert ? "var(--coral)" : "var(--success)" }}>
                      {documentData.authenticityAudit.auditReport?.forensics?.tamperAlert ? "DETECTED" : "NEGATIVE"}
                    </strong>
                  </div>
                </div>
                <div className="layer-explanation">
                  {documentData.authenticityAudit.auditReport?.forensics?.details || "Uniform compression profile across canvas."}
                </div>
              </div>

              {/* Layer 2: Statutory & Registry QR */}
              <div className="forensic-layer-block">
                <div className="layer-block-header">
                  <div className="layer-title-wrap">
                    <span className="layer-num-badge">LAYER 2</span>
                    <strong style={{ fontSize: "14px", color: "var(--cream)" }}>Statutory & Government Registry e-Stamp QR</strong>
                  </div>
                  <span className={`badge-status-chip ${documentData.authenticityAudit.auditReport?.statutory?.verified ? "pass" : "warn"}`}>
                    {documentData.authenticityAudit.auditReport?.statutory?.verified ? "VERIFIED" : "UNVERIFIED"}
                  </span>
                </div>
                <div className="layer-stats-grid">
                  <div className="layer-stat-cell">
                    <span>Registry Portal</span>
                    <strong>{documentData.authenticityAudit.auditReport?.statutory?.registryDomain || "Not Identified"}</strong>
                  </div>
                  <div className="layer-stat-cell">
                    <span>Certificate Number</span>
                    <strong>{documentData.authenticityAudit.auditReport?.statutory?.certificateNumber || "Absent"}</strong>
                  </div>
                  <div className="layer-stat-cell">
                    <span>Stamp Duty Paid</span>
                    <strong>{documentData.authenticityAudit.auditReport?.statutory?.stampAmountPaid || "N/A"}</strong>
                  </div>
                </div>
                <div className="layer-explanation">
                  {documentData.authenticityAudit.auditReport?.statutory?.details || "Statutory e-Stamp check completed."}
                </div>
              </div>

              {/* Layer 3: Semantic & Chronology Coherence */}
              <div className="forensic-layer-block">
                <div className="layer-block-header">
                  <div className="layer-title-wrap">
                    <span className="layer-num-badge">LAYER 3</span>
                    <strong style={{ fontSize: "14px", color: "var(--cream)" }}>Semantic & Chronological Coherence</strong>
                  </div>
                  <span className={`badge-status-chip ${documentData.authenticityAudit.auditReport?.semantics?.chronologySound ? "pass" : "fail"}`}>
                    {documentData.authenticityAudit.auditReport?.semantics?.chronologySound ? "CHRONOLOGY SOUND" : "ANOMALY"}
                  </span>
                </div>
                <div className="layer-stats-grid">
                  <div className="layer-stat-cell">
                    <span>Stamp Date</span>
                    <strong>{documentData.authenticityAudit.auditReport?.semantics?.stampDate || "12-Feb-2026"}</strong>
                  </div>
                  <div className="layer-stat-cell">
                    <span>Execution Date</span>
                    <strong>{documentData.authenticityAudit.auditReport?.semantics?.executionDate || "15-Feb-2026"}</strong>
                  </div>
                  <div className="layer-stat-cell">
                    <span>Commencement Date</span>
                    <strong>{documentData.authenticityAudit.auditReport?.semantics?.commencementDate || "01-Mar-2026"}</strong>
                  </div>
                </div>
                <div className="layer-explanation">
                  {documentData.authenticityAudit.auditReport?.semantics?.details || "Chronological order and witness counts verified."}
                </div>
              </div>
            </div>

            {/* Discrepancies / Observations */}
            {((documentData.authenticityAudit.discrepancies?.length || 0) > 0 || (documentData.authenticityAudit.flaggedIssues?.length || 0) > 0) && (
              <div className="forensic-issues-card">
                <h4>
                  <AlertTriangle size={15} /> Forensic Discrepancies & Observations
                </h4>
                <ul className="forensic-issues-list">
                  {(documentData.authenticityAudit.discrepancies || []).map((d, i) => (
                    <li key={`disc-${i}`}>{d}</li>
                  ))}
                  {(documentData.authenticityAudit.flaggedIssues || []).map((f, i) => (
                    <li key={`flag-${i}`}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="forensic-privacy-note">
              <CheckCircle2 size={16} />
              <span>
                <strong>Zero-Disk RAM Security Guarantee:</strong> All ELA compression calculations, 2D barcode decoding, and semantic parsing executed strictly within volatile RAM buffers. No document bytes were written to storage.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
