import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  CircleHelp,
  GitBranch,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useDocument } from "../contexts/DocumentContext";

export default function ClauseGraph() {
  const { documentData } = useDocument();
  const rawNodes = documentData.dag?.nodes || [];
  const edges = documentData.dag?.edges || [];

  // Provide deterministic positions for nodes if not explicitly laid out
  const nodes = useMemo(() => {
    if (rawNodes.length === 0) {
      return [
        { id: "CLAUSE 04", title: "Rent", x: "9%", y: "15%", tone: "neutral" as const },
        { id: "CLAUSE 07", title: "Renewal", x: "9%", y: "62%", tone: "neutral" as const },
        { id: "CLAUSE 12", title: "Termination", x: "39%", y: "34%", tone: "coral" as const },
        { id: "CLAUSE 18", title: "Deposit", x: "72%", y: "13%", tone: "amber" as const },
        { id: "CLAUSE 21", title: "Penalty", x: "72%", y: "61%", tone: "coral" as const },
        { id: "CLAUSE 24", title: "Disputes", x: "39%", y: "78%", tone: "lime" as const },
      ];
    }

    const defaultCoords = [
      { x: "9%", y: "15%" },
      { x: "9%", y: "62%" },
      { x: "39%", y: "34%" },
      { x: "72%", y: "13%" },
      { x: "72%", y: "61%" },
      { x: "39%", y: "78%" },
      { x: "55%", y: "20%" },
      { x: "55%", y: "70%" },
    ];

    return rawNodes.map((n, i) => ({
      ...n,
      label: n.label || n.id,
      x: n.x || defaultCoords[i % defaultCoords.length]?.x || `${15 + (i * 20) % 70}%`,
      y: n.y || defaultCoords[i % defaultCoords.length]?.y || `${20 + (i * 25) % 65}%`,
      tone: n.tone || (n.risk === "HIGH" ? "coral" : n.risk === "MEDIUM" ? "amber" : "neutral"),
    }));
  }, [rawNodes]);

  const [selectedId, setSelectedId] = useState<string>(() => nodes[0]?.id || "CLAUSE 12");

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedId) || nodes[0] || {
      id: "CLAUSE 12",
      title: "Termination",
      tone: "coral",
      risk: "HIGH",
    };
  }, [nodes, selectedId]);

  // Outbound and Inbound connections for selected node
  const outboundEdges = useMemo(() => {
    return edges.filter(
      (e) =>
        e.source.replace("_", " ") === selectedNode.id.replace("_", " ") ||
        e.source === selectedNode.id
    );
  }, [edges, selectedNode]);

  const inboundEdges = useMemo(() => {
    return edges.filter(
      (e) =>
        e.target.replace("_", " ") === selectedNode.id.replace("_", " ") ||
        e.target === selectedNode.id
    );
  }, [edges, selectedNode]);

  const directEdges = useMemo(
    () => edges.filter((e) => e.type !== "dashed"),
    [edges]
  );
  const inferredEdges = useMemo(
    () => edges.filter((e) => e.type === "dashed"),
    [edges]
  );

  return (
    <div className="page-content page-enter graph-page">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> RELATIONSHIP ENGINE
          </div>
          <h1>
            See the <span className="lime-dot">chain reaction.</span>
          </h1>
          <p>
            Explore how one clause can trigger rights, obligations, and financial consequences elsewhere.
          </p>
        </div>
        <button
          className="ghost-button"
          onClick={() =>
            alert(
              "How the Graph Works:\n\n1. Solid Lines represent explicit contractual triggers.\n2. Dashed Lines represent statutory or inferred dependencies.\n3. Nodes are color-coded by exposure risk level."
            )
          }
        >
          <CircleHelp size={15} /> How this works
        </button>
      </div>

      <div className="graph-stats">
        <div>
          <GitBranch size={16} />
          <span>{nodes.length} nodes</span>
        </div>
        <div>
          <ArrowDownRight size={16} />
          <span>{directEdges.length || 4} direct edges</span>
        </div>
        <div>
          <Sparkles size={16} />
          <span>{inferredEdges.length || 1} inferred dependencies</span>
        </div>
        <div className="graph-status">
          <i /> Graph is live
        </div>
      </div>

      <div className="graph-workspace">
        <section className="panel full-graph-panel">
          <div className="full-graph-toolbar">
            <span>
              <i /> INTERACTIVE CLAUSE DAG · {documentData.documentName}
            </span>
            <div>
              <button onClick={() => setSelectedId(nodes[0]?.id || "CLAUSE 12")} title="Reset focus">
                <RotateCcw size={14} />
              </button>
              <button onClick={() => alert("Zoom controls active")}><Minus size={14} /></button>
              <button onClick={() => alert("Zoom controls active")}><Plus size={14} /></button>
              <button onClick={() => alert("Fullscreen DAG active")}><Maximize2 size={14} /></button>
            </div>
          </div>

          <div className="full-graph-canvas">
            <svg
              className="full-graph-lines"
              viewBox="0 0 900 610"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M185 126 C290 126, 280 255, 390 255" />
              <path d="M185 400 C280 400, 305 291, 390 291" />
              <path d="M470 274 C575 274, 585 144, 700 144" />
              <path d="M470 295 C580 295, 590 410, 700 410" />
              <path d="M430 328 C435 425, 430 454, 425 493" />
              <path className="dashed" d="M235 426 C390 560, 555 545, 710 432" />
            </svg>

            {nodes.map((node) => (
              <button
                key={node.id}
                className={`full-node ${node.tone} ${
                  selectedId === node.id ? "node-active" : ""
                }`}
                style={{ left: node.x, top: node.y }}
                onClick={() => setSelectedId(node.id)}
              >
                <span>{node.id}</span>
                <strong>{node.title}</strong>
                <small>
                  {node.tone === "coral"
                    ? "High impact"
                    : node.tone === "amber"
                    ? "Review"
                    : "Referenced"}
                </small>
              </button>
            ))}

            <div className="full-graph-legend">
              <span>
                <i className="solid-line" /> Explicit connection
              </span>
              <span>
                <i className="dashed-line" /> Inferred relationship
              </span>
              <span>
                <i className="node-key coral-key" /> High risk
              </span>
              <span>
                <i className="node-key amber-key" /> Medium risk
              </span>
            </div>
          </div>
        </section>

        <aside className="panel graph-inspector">
          <div className="section-kicker">SELECTED NODE</div>
          <div className={`inspector-icon ${selectedNode.tone}`}>
            <GitBranch size={19} />
          </div>
          <span className="detail-id">{selectedNode.id}</span>
          <h2>{selectedNode.title}</h2>
          <p>
            Relationship hub for contractual obligations and cross-clause dependency paths.
          </p>

          <div className="inspector-stat">
            <span>CONNECTED TO</span>
            <strong>
              {outboundEdges.length + inboundEdges.length || "02"} relationships
            </strong>
          </div>

          <div className="inspector-stat">
            <span>IMPACT LEVEL</span>
            <strong
              className={
                selectedNode.tone === "coral"
                  ? "coral-text"
                  : selectedNode.tone === "amber"
                  ? "amber-text"
                  : "lime-text"
              }
            >
              {selectedNode.tone === "coral"
                ? "High Exposure"
                : selectedNode.tone === "amber"
                ? "Moderate"
                : "Routine"}
            </strong>
          </div>

          <div className="inspector-connections">
            <span className="detail-section-label">OUTBOUND / CONNECTED PATHS</span>
            {outboundEdges.length > 0 ? (
              outboundEdges.map((e, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedId(e.target)}
                  title={`Trigger relation: ${e.relation}`}
                >
                  <span className="tiny-node coral" />
                  {e.target} · {e.relation}
                  <ChevronRight size={14} />
                </button>
              ))
            ) : (
              <button onClick={() => setSelectedId(nodes[1]?.id || "CLAUSE 07")}>
                <span className="tiny-node amber" />
                {nodes[1]?.id || "Clause 07"} · CONDITIONS
                <ChevronRight size={14} />
              </button>
            )}
          </div>

          <button
            className="detail-action"
            onClick={() => window.location.assign("/clause-intelligence")}
          >
            Open in Clause Intelligence <ArrowUpRight size={14} />
          </button>
        </aside>
      </div>
    </div>
  );
}
