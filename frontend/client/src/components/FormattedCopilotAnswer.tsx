import React from "react";
import { ShieldCheck, FileText, CheckCircle2, ChevronRight, AlertCircle } from "lucide-react";

interface FormattedCopilotAnswerProps {
  answer: string;
  citations?: Array<{ clauseId: string; page: number; snippet?: string }>;
  onSelectClause?: (clauseId: string) => void;
}

export const FormattedCopilotAnswer: React.FC<FormattedCopilotAnswerProps> = ({
  answer,
  citations = [],
  onSelectClause,
}) => {
  if (!answer) return null;

  // Render formatted text with bold, currency, and clickable clause pills
  const formatInlineText = (text: string) => {
    // Split by citations [Clause XX (Page YY)] or [CLAUSE_XX (p. YY)]
    const citationRegex = /\[(CLAUSE_?\d+|Clause\s*\d+|Cl\.\s*\d+)[^\]]*\]/gi;
    const parts = text.split(citationRegex);

    return parts.map((part, index) => {
      // Check if this part matches a clause citation
      const match = part.match(/^(?:CLAUSE_?|Clause\s*|Cl\.\s*)(\d+)/i);
      if (match) {
        const num = match[1].padStart(2, "0");
        const clauseId = `CLAUSE_${num}`;
        return (
          <button
            key={index}
            type="button"
            className="copilot-inline-pill"
            onClick={() => onSelectClause && onSelectClause(clauseId)}
            title={`View Clause ${num}`}
          >
            <FileText size={10} className="pill-icon" />
            <span>Clause {num}</span>
          </button>
        );
      }

      // Format bold markdown and currency amounts
      return (
        <span key={index}>
          {formatBoldAndCurrency(part)}
        </span>
      );
    });
  };

  const formatBoldAndCurrency = (text: string) => {
    // Split by **bold**
    const boldParts = text.split(/\*\*(.*?)\*\*/g);
    return boldParts.map((bPart, bIdx) => {
      // Odd indices are bold text
      if (bIdx % 2 === 1) {
        return (
          <strong key={bIdx} className="copilot-strong-text">
            {formatCurrencyTokens(bPart)}
          </strong>
        );
      }
      return <React.Fragment key={bIdx}>{formatCurrencyTokens(bPart)}</React.Fragment>;
    });
  };

  const formatCurrencyTokens = (text: string) => {
    // Highlight Rupee amounts (e.g. ₹25,000)
    const currencyRegex = /(₹[\d,]+(?:\.\d+)?)/g;
    const parts = text.split(currencyRegex);
    return parts.map((currPart, cIdx) => {
      if (currPart.startsWith("₹")) {
        return (
          <span key={cIdx} className="copilot-currency-badge">
            {currPart}
          </span>
        );
      }
      return currPart;
    });
  };

  // Parse markdown lines into structured semantic sections
  const lines = answer.split("\n");
  const sections: React.ReactNode[] = [];

  let currentBullets: string[] = [];
  let isInsideRecommendation = false;
  let recBullets: string[] = [];

  const flushBullets = () => {
    if (currentBullets.length > 0) {
      const listItems = [...currentBullets];
      currentBullets = [];
      sections.push(
        <ul key={`ul-${sections.length}`} className="copilot-bullet-list">
          {listItems.map((item, idx) => (
            <li key={idx} className="copilot-bullet-item">
              <span className="copilot-bullet-dot" />
              <div className="copilot-bullet-content">{formatInlineText(item)}</div>
            </li>
          ))}
        </ul>
      );
    }
  };

  const flushRecommendation = () => {
    if (recBullets.length > 0) {
      const items = [...recBullets];
      recBullets = [];
      sections.push(
        <div key={`rec-${sections.length}`} className="copilot-recommendation-card">
          <div className="rec-card-header">
            <div className="rec-icon-box">
              <ShieldCheck size={16} />
            </div>
            <div>
              <span className="rec-kicker">Recommended Action Plan</span>
              <h4>Bottom-Line Operational Advice</h4>
            </div>
          </div>
          <div className="rec-card-body">
            {items.map((item, idx) => (
              <div key={idx} className="rec-step-item">
                <span className="rec-step-num">{idx + 1}</span>
                <div className="rec-step-text">{formatInlineText(item)}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    // Check for divider
    if (rawLine === "---" || rawLine === "***" || rawLine === "___") {
      flushBullets();
      if (isInsideRecommendation) {
        flushRecommendation();
        isInsideRecommendation = false;
      }
      continue;
    }

    // Check for recommendation heading
    if (
      rawLine.toLowerCase().includes("bottom-line operational recommendation") ||
      rawLine.toLowerCase().includes("operational recommendation") ||
      rawLine.toLowerCase().includes("recommended action")
    ) {
      flushBullets();
      isInsideRecommendation = true;
      continue;
    }

    // Check for other markdown headings
    if (rawLine.startsWith("#")) {
      flushBullets();
      if (isInsideRecommendation) {
        flushRecommendation();
        isInsideRecommendation = false;
      }
      const headingText = rawLine.replace(/^#+\s*/, "");
      sections.push(
        <h4 key={`h4-${sections.length}`} className="copilot-section-heading">
          {formatInlineText(headingText)}
        </h4>
      );
      continue;
    }

    // Check for bullet items (*, -, or 1., 2.)
    const bulletMatch = rawLine.match(/^(?:[-*•]|\d+\.)\s+(.*)/);
    if (bulletMatch) {
      const itemText = bulletMatch[1];
      if (isInsideRecommendation) {
        recBullets.push(itemText);
      } else {
        currentBullets.push(itemText);
      }
      continue;
    }

    // Ordinary paragraph / direct answer
    if (isInsideRecommendation) {
      recBullets.push(rawLine);
    } else {
      flushBullets();
      // If it's the very first paragraph, render as prominent executive answer
      const isLead = sections.length === 0;
      sections.push(
        <p
          key={`p-${sections.length}`}
          className={isLead ? "copilot-lead-answer" : "copilot-paragraph"}
        >
          {formatInlineText(rawLine)}
        </p>
      );
    }
  }

  flushBullets();
  if (isInsideRecommendation) {
    flushRecommendation();
  }

  return (
    <div className="copilot-formatted-container">
      {sections}
    </div>
  );
};

export default FormattedCopilotAnswer;
