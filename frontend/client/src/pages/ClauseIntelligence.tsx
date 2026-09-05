import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  FileText,
  Search,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useDocument } from "../contexts/DocumentContext";

export default function ClauseIntelligence() {
  const { documentData } = useDocument();
  const clauses = documentData.clauses || [];

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All clauses");
  const [selectedId, setSelectedId] = useState<string>(() => {
    return clauses[0]?.id || "CLAUSE 12";
  });

  const selectedClause = useMemo(() => {
    return (
      clauses.find((c) => c.id === selectedId || c.clauseId === selectedId) ||
      clauses[0] || {
        id: "CLAUSE 12",
        clauseId: "CLAUSE_12",
        title: "Termination and notice period",
        category: "Termination",
        risk: "HIGH",
        page: "5",
        score: 82,
        text: "Either party may terminate this agreement by providing a 60-day written notice to the other party.",
        plainLanguage: "This clause gives either party a defined exit path, but your notice obligation is strict. Missing the 60-day window activates a separate financial penalty.",
        connectedClauses: ["CLAUSE 07", "CLAUSE 21"],
      }
    );
  }, [clauses, selectedId]);

  const visibleClauses = useMemo(() => {
    return clauses.filter((clause) => {
      const matchText = `${clause.id} ${clause.title} ${clause.category} ${clause.text}`.toLowerCase();
      const matchesQuery = matchText.includes(query.toLowerCase());

      let matchesFilter = true;
      if (filter === "High") matchesFilter = clause.risk === "HIGH" || clause.risk === "CRITICAL";
      else if (filter === "Medium") matchesFilter = clause.risk === "MEDIUM";
      else if (filter === "Low") matchesFilter = clause.risk === "LOW";
      else if (filter !== "All clauses") {
        matchesFilter = clause.category.toLowerCase().includes(filter.toLowerCase());
      }

      return matchesQuery && matchesFilter;
    });
  }, [clauses, filter, query]);

  const highRiskCount = useMemo(
    () => clauses.filter((c) => c.risk === "HIGH" || c.risk === "CRITICAL").length,
    [clauses]
  );

  const edgeCount = useMemo(
    () => documentData.dag?.edges?.length || 17,
    [documentData]
  );

  const exportClausesJSON = () => {
    const blob = new Blob([JSON.stringify(clauses, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `LegalLens_Clauses_${documentData.sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page-content page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> DOCUMENT INTELLIGENCE
          </div>
          <h1>
            Every clause, <span className="lime-dot">made legible.</span>
          </h1>
          <p>Search the agreement by meaning, risk, or consequence—not just keywords.</p>
        </div>
        <button className="ghost-button" onClick={exportClausesJSON}>
          <ArrowUpRight size={15} /> Export analysis
        </button>
      </div>

      <div className="intelligence-summary">
        <div>
          <span className="summary-label">CLAUSES ANALYZED</span>
          <strong>{clauses.length || 24}</strong>
          <small>Across document pages</small>
        </div>
        <div>
          <span className="summary-label">HIGH RISK</span>
          <strong className="coral-text">{highRiskCount < 10 ? `0${highRiskCount}` : highRiskCount}</strong>
          <small>Require immediate attention</small>
        </div>
        <div>
          <span className="summary-label">CONNECTED EDGES</span>
          <strong className="lime-text">{edgeCount}</strong>
          <small>Graph relationships</small>
        </div>
        <div>
          <span className="summary-label">SESSION STATUS</span>
          <strong className="summary-time">Live</strong>
          <small>Zero-disk ephemeral cache</small>
        </div>
      </div>

      <div className="intelligence-layout">
        <section className="panel clause-browser">
          <div className="browser-toolbar">
            <div className="search-field">
              <Search size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search clauses, obligations, amounts, keywords…"
              />
            </div>
            <button className="filter-button" onClick={() => setFilter("All clauses")}>
              <SlidersHorizontal size={14} /> Reset <ChevronDown size={13} />
            </button>
          </div>

          <div className="filter-pills">
            {["All clauses", "High", "Medium", "Low", "Financial", "Termination", "Deposit"].map((item) => (
              <button
                key={item}
                className={filter === item ? "active" : ""}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="clause-browser-head">
            <span>CLAUSE / TITLE</span>
            <span>RISK</span>
            <span>PAGE</span>
          </div>

          <div className="clause-browser-list">
            {visibleClauses.map((clause) => (
              <button
                key={clause.id}
                className={`browser-row ${
                  selectedClause.id === clause.id || selectedClause.clauseId === clause.id ? "selected" : ""
                }`}
                onClick={() => setSelectedId(clause.id)}
              >
                <div className={`browser-risk-bar ${clause.risk.toLowerCase()}`} />
                <div className="browser-clause-copy">
                  <span>
                    {clause.id} · {clause.category}
                  </span>
                  <strong>{clause.title}</strong>
                  <small>{clause.text}</small>
                </div>
                <span className={`risk-label-badge ${clause.risk.toLowerCase()}`}>
                  {clause.risk}
                </span>
                <span className="page-number">p. {clause.page}</span>
                <ChevronRight size={15} />
              </button>
            ))}

            {visibleClauses.length === 0 && (
              <div className="empty-search">
                <Search size={18} />
                <strong>No clauses match that search.</strong>
                <span>Try a different keyword or reset filters.</span>
              </div>
            )}
          </div>
        </section>

        <aside className="panel clause-detail">
          <div className="detail-top">
            <span className={`risk-label-badge ${selectedClause.risk.toLowerCase()}`}>
              {selectedClause.risk} RISK
            </span>
            <button onClick={() => alert(`Operational plain-read for ${selectedClause.id}:\n\n${selectedClause.plainLanguage || selectedClause.text}`)}>
              <Sparkles size={14} /> Explain
            </button>
          </div>

          <span className="detail-id">
            {selectedClause.id} · PAGE {selectedClause.page}
          </span>
          <h2>{selectedClause.title}</h2>
          <p className="detail-quote">“{selectedClause.text}”</p>

          <div className="detail-score">
            <div>
              <span>EXPOSURE SCORE</span>
              <strong>
                {selectedClause.score}
                <small>/100</small>
              </strong>
            </div>
            <div className="detail-score-track">
              <i style={{ width: `${selectedClause.score}%` }} />
            </div>
          </div>

          <div className="detail-section">
            <span className="detail-section-label">PLAIN-LANGUAGE READ</span>
            <p>
              {selectedClause.plainLanguage ||
                "This clause defines legal obligations between the signing parties with specific notice conditions and liability allocations."}
            </p>
          </div>

          <div className="detail-section">
            <span className="detail-section-label">CONNECTED CLAUSES</span>
            {selectedClause.connectedClauses && selectedClause.connectedClauses.length > 0 ? (
              selectedClause.connectedClauses.map((connId: string) => {
                const connClause = clauses.find(
                  (c) => c.id === connId || c.clauseId === connId
                );
                return (
                  <div
                    className="connected-clause"
                    key={connId}
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedId(connId)}
                  >
                    <span>{connId.replace("_", " ")}</span>
                    <strong>{connClause?.title || "Connected obligation"}</strong>
                    <ChevronRight size={14} />
                  </div>
                );
              })
            ) : (
              <span style={{ fontSize: "13px", color: "#8b949e" }}>
                No direct triggers or penalty links registered for this clause.
              </span>
            )}
          </div>

          <button
            className="detail-action"
            onClick={() => {
              window.location.assign("/clause-graph");
            }}
          >
            <FileText size={15} /> View in Clause Graph <ArrowUpRight size={14} />
          </button>
        </aside>
      </div>
    </div>
  );
}
