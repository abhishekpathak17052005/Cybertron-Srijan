import { ArrowRight, Check, FileSearch, GitBranch, LockKeyhole, ShieldCheck, Sparkles, TimerReset, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

function goTo(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const proofPoints = ["Clause-level citations", "Risk mapped in minutes", "Session-scoped by default"];

export default function Landing() {
  return (
    <main className="public-shell">
      <nav className="public-nav" aria-label="Public navigation">
        <button className="public-brand" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
          <span className="public-brand-mark"><ShieldCheck size={17} /></span>
          <span><strong>LegalLens</strong><small>Contract intelligence</small></span>
        </button>
        <div className="public-nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#privacy">Privacy</a>
          <button className="public-login-link" onClick={() => goTo("/login")}>Sign in</button>
          <Button className="public-nav-cta" onClick={() => goTo("/register")}>Start free <ArrowRight size={15} /></Button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="public-eyebrow"><span /> PRIVATE CONTRACT INTELLIGENCE</div>
          <h1>Read the fine print like it was written <em>for you.</em></h1>
          <p>LegalLens turns overwhelming agreements into clear risks, connected obligations, and the next decision you need to make.</p>
          <div className="landing-actions">
            <Button className="landing-primary" onClick={() => goTo("/register")}>Analyze your first contract <ArrowRight size={17} /></Button>
            <button className="landing-secondary" onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>See how it works <span>↓</span></button>
          </div>
          <div className="proof-row">{proofPoints.map((point) => <span key={point}><Check size={13} /> {point}</span>)}</div>
        </div>

        <div className="landing-visual" aria-label="LegalLens contract intelligence preview">
          <div className="visual-glow" />
          <div className="visual-topline"><span><i /> LIVE DOCUMENT PULSE</span><span>LEASE_04.PDF</span></div>
          <div className="visual-title"><div><span className="visual-kicker">01 · AGREEMENT SNAPSHOT</span><h2>Residential rental agreement</h2></div><span className="visual-score">68 <small>/100</small></span></div>
          <div className="visual-bars"><div><span>Termination</span><i><b style={{ width: "82%" }} /></i><strong>82</strong></div><div><span>Financial</span><i><b style={{ width: "74%" }} /></i><strong>74</strong></div><div><span>Deposit</span><i><b className="bar-lime" style={{ width: "31%" }} /></i><strong>31</strong></div></div>
          <div className="visual-graph"><svg viewBox="0 0 500 150" preserveAspectRatio="none" aria-hidden="true"><path d="M58 75 C135 75, 160 34, 235 34 S350 105, 440 105" /><path d="M58 75 C145 75, 171 116, 235 116 S355 36, 440 36" /></svg><span className="visual-node node-one">CLAUSE 07<strong>Renewal</strong></span><span className="visual-node node-two">CLAUSE 12<strong>Termination</strong></span><span className="visual-node node-three">CLAUSE 21<strong>Penalty</strong></span></div>
          <div className="visual-footer"><span><Sparkles size={14} /> 24 clauses mapped</span><span><LockKeyhole size={13} /> Session-scoped</span></div>
        </div>
      </section>

      <section className="landing-marquee"><span>Less scanning. More understanding.</span><span>From document to decision.</span><span>Know what the contract can cost.</span></section>

      <section className="landing-section" id="how-it-works">
        <div className="section-intro"><div className="public-eyebrow"><span /> A BETTER WAY THROUGH THE AGREEMENT</div><h2>One document. <em>A much clearer picture.</em></h2><p>LegalLens gives every important sentence a place in the bigger story.</p></div>
        <div className="feature-grid">
          <article className="feature-card feature-large"><div className="feature-icon"><FileSearch size={19} /></div><span>01 · MAKE IT LEGIBLE</span><h3>Search by consequence, not just keywords.</h3><p>Find the obligations, penalties, and rights hiding in ordinary language. Every answer points back to the source clause.</p><div className="mini-search"><FileSearch size={14} /><span>What happens if I leave early?</span><ArrowRight size={14} /></div></article>
          <article className="feature-card"><div className="feature-icon orange"><GitBranch size={19} /></div><span>02 · SEE THE CHAIN</span><h3>Nothing important exists in isolation.</h3><p>Follow how one notice window can trigger a fee, a renewal right, or a deposit decision somewhere else.</p><div className="feature-lines"><i /><i /><i /></div></article>
          <article className="feature-card"><div className="feature-icon green"><TimerReset size={19} /></div><span>03 · STAY AHEAD</span><h3>Turn fine print into a timeline.</h3><p>Get the moments that matter surfaced before they become expensive surprises.</p><div className="mini-timeline"><b>30 JAN</b><span>Serve termination notice</span><i /></div></article>
        </div>
      </section>

      <section className="privacy-band" id="privacy"><div className="privacy-band-icon"><ShieldCheck size={22} /></div><div><span className="public-eyebrow"><span /> BUILT FOR SENSITIVE DOCUMENTS</span><h2>Your contract stays yours.</h2><p>LegalLens is designed around a simple promise: understand the document without turning it into a permanent data trail.</p></div><div className="privacy-points"><span><LockKeyhole size={14} /> No source file storage</span><span><UploadCloud size={14} /> Session-scoped analysis</span></div></section>

      <section className="landing-final"><div><span className="public-eyebrow"><span /> START WITH CLARITY</span><h2>The next decision is already in the document.</h2></div><Button className="landing-primary" onClick={() => goTo("/register")}>Create your workspace <ArrowRight size={17} /></Button></section>
      <footer className="public-footer"><span>LegalLens / Private intelligence layer</span><span>Made for clearer decisions, one clause at a time.</span></footer>
    </main>
  );
}
