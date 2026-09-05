import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  Command,
  FileText,
  LayoutDashboard,
  Loader2,
  Network,
  Settings2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import AIAnalyzer from "./pages/AIAnalyzer";
import Auth from "./pages/Auth";
import ClauseGraph from "./pages/ClauseGraph";
import ClauseIntelligence from "./pages/ClauseIntelligence";
import Home from "./pages/Home";
import Landing from "./pages/Landing";
import Reminders from "./pages/Reminders";
import Settings from "./pages/Settings";
import { DocumentProvider, useDocument } from "./contexts/DocumentContext";

const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Clause intelligence", icon: FileText },
  { label: "Clause graph", icon: Network },
];

function AppContent() {
  const {
    documentData,
    isAnalyzing,
    uploadProgress,
    uploadStage,
    uploadError,
    tasks,
    uploadDocument,
  } = useDocument();

  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [activeNav, setActiveNav] = useState(() => {
    const path = window.location.pathname;
    if (path === "/clause-intelligence") return "Clause intelligence";
    if (path === "/clause-graph") return "Clause graph";
    if (path === "/reminders") return "Reminders";
    if (path === "/settings") return "Settings";
    if (path === "/ai-analyzer") return "AI Analyzer";
    return "Overview";
  });
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("om.mehta@example.com");
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (label: string) => {
    const nextPath = label === "Overview" ? "/workspace" : `/${label.toLowerCase().replaceAll(" ", "-")}`;
    setActiveNav(label);
    setCurrentPath(nextPath);
    window.history.pushState({}, "", nextPath);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    setSelectedFile(event.dataTransfer.files[0] ?? null);
  };

  const startAnalysis = async () => {
    if (!selectedFile) return;
    const success = await uploadDocument(selectedFile, recipientEmail);
    if (success) {
      setTimeout(() => {
        setShowUpload(false);
        setSelectedFile(null);
        navigate("Overview");
      }, 700);
    }
  };

  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("legallens_user");
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return { name: "Om Mehta", email: "om.mehta@example.com" };
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("legallens_user");
      if (saved) setUserProfile(JSON.parse(saved));
    } catch {}
  }, [currentPath]);

  const userInitials = userProfile.name
    ? userProfile.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "OM"
    : "OM";

  const handleAuthLogin = (user: { name: string; email: string }) => {
    setUserProfile(user);
    setCurrentPath("/workspace");
    setActiveNav("Overview");
    window.history.pushState({}, "", "/workspace");
  };

  const handleRouteNavigate = (path: string) => {
    setCurrentPath(path);
    window.history.pushState({}, "", path);
  };

  if (currentPath === "/") return <Landing onNavigate={handleRouteNavigate} />;
  if (currentPath === "/login") return <Auth mode="login" onNavigate={handleRouteNavigate} onLogin={handleAuthLogin} />;
  if (currentPath === "/register") return <Auth mode="register" onNavigate={handleRouteNavigate} onLogin={handleAuthLogin} />;

  const page =
    activeNav === "AI Analyzer"
      ? <AIAnalyzer />
      : activeNav === "Clause intelligence"
        ? <ClauseIntelligence />
        : activeNav === "Clause graph"
          ? <ClauseGraph />
          : activeNav === "Reminders"
            ? <Reminders />
            : activeNav === "Settings"
              ? <Settings />
              : <Home onUpload={() => setShowUpload(true)} />;

  const pendingTasksCount = tasks.filter((task) => task.status !== "COMPLETED").length;
  const graphNodeCount = documentData.dag?.nodes?.length || 24;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><ShieldCheck size={17} strokeWidth={2.4} /></div>
          <div>
            <span className="brand-name">LegalLens</span>
            <span className="brand-subtitle">Contract intelligence</span>
          </div>
        </div>

        <div className="workspace-switcher" title={documentData.documentName}>
          <div className="workspace-avatar">{userInitials}</div>
          <div className="workspace-copy">
            <span>{documentData.documentName || `${userProfile.name}'s Workspace`}</span>
            <small>{documentData.summary?.documentType || "Personal workspace"}</small>
          </div>
          <ChevronDown size={15} className="muted-icon" />
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          <span className="nav-section-label">Workspace</span>
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activeNav === label ? "active" : ""}`} onClick={() => navigate(label)}>
              <Icon size={16} strokeWidth={1.9} />
              <span>{label}</span>
              {label === "Clause graph" && <span className="nav-count">{graphNodeCount}</span>}
            </button>
          ))}
          <span className="nav-section-label nav-section-spaced">Tools</span>
          <button className={`nav-item ${activeNav === "AI Analyzer" ? "active" : ""}`} onClick={() => navigate("AI Analyzer")}>
            <Bot size={16} strokeWidth={1.9} />
            <span>AI Analyzer</span>
            <span className="nav-shortcut">⌘ A</span>
          </button>
          <button className="nav-item" onClick={() => setShowUpload(true)}>
            <UploadCloud size={16} strokeWidth={1.9} />
            <span>Analyze a document</span>
            <span className="nav-shortcut">⌘ U</span>
          </button>
          <button className={`nav-item ${activeNav === "Reminders" ? "active" : ""}`} onClick={() => navigate("Reminders")}>
            <Bell size={16} strokeWidth={1.9} />
            <span>Reminders</span>
            {pendingTasksCount > 0 && <span className="nav-dot" />}
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy-seal">
            <div className="privacy-icon"><ShieldCheck size={15} /></div>
            <div>
              <strong>Private by design</strong>
              <span>Session expires in 23h 59m</span>
            </div>
          </div>
          <button className={`nav-item settings-item ${activeNav === "Settings" ? "active" : ""}`} onClick={() => navigate("Settings")}>
            <Settings2 size={16} strokeWidth={1.9} />
            <span>Settings</span>
          </button>
          <div className="user-row">
            <div className="user-avatar">{userInitials}</div>
            <div className="user-copy">
              <strong>{userProfile.name}</strong>
              <span>{userProfile.email || "Owner"}</span>
            </div>
            <Command size={14} className="muted-icon" />
          </div>
        </div>
      </aside>

      <main className="main-canvas">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{activeNav}</strong>
          </div>
          <div className="topbar-actions">
            <button className="search-trigger" onClick={() => navigate("Clause intelligence")}>
              <Command size={14} />
              <span>Search clauses</span>
              <kbd>⌘ K</kbd>
            </button>
            <button className="icon-button" aria-label="Notifications" onClick={() => navigate("Reminders")}>
              <Bell size={17} />
              {pendingTasksCount > 0 && <span className="notification-pip" />}
            </button>
            <button className="top-avatar">{userInitials}</button>
          </div>
        </header>
        {page}
      </main>

      {showUpload && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="upload-title" onClick={() => !isAnalyzing && setShowUpload(false)}>
          <div className="upload-modal" onClick={(event) => event.stopPropagation()}>
            {!isAnalyzing && (
              <button className="modal-close" onClick={() => setShowUpload(false)} aria-label="Close">×</button>
            )}
            <div className="modal-eyebrow"><Sparkles size={14} /> In-Memory Ingestion Pipeline</div>
            <h2 id="upload-title">Bring a contract into focus.</h2>
            <p>Drop a PDF, DOCX, or image here. Your document stays strictly in RAM buffer and is automatically purged after the session.</p>
            <input type="file" ref={fileInputRef} className="file-input" accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.txt" onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)} />
            <button type="button" className={`dropzone ${isDragOver ? "dragover" : ""}`} onDragOver={(event) => { event.preventDefault(); setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={handleDrop} onClick={() => !isAnalyzing && fileInputRef.current?.click()}>
              {isAnalyzing ? (
                <>
                  <Loader2 size={32} className="animate-spin" />
                  <strong>{uploadStage || "Processing..."}</strong>
                  <span>{uploadProgress}% complete · Zero persistent file storage</span>
                </>
              ) : selectedFile ? (
                <>
                  <CheckCircle2 size={30} className="upload-success" />
                  <strong>{selectedFile.name}</strong>
                  <span>{(selectedFile.size / 1024).toFixed(1)} KB · Ready to analyze</span>
                </>
              ) : (
                <>
                  <UploadCloud size={28} />
                  <strong>Drop your document here</strong>
                  <span>PDF, DOCX, PNG or JPG · max 25 MB</span>
                </>
              )}
            </button>
            <label className="upload-email-label">
              Notification email
              <input type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} disabled={isAnalyzing} />
            </label>
            {uploadError && <div className="upload-error"><AlertCircle size={16} /><span>{uploadError}</span></div>}
            <div className="modal-footer">
              <span><ShieldCheck size={14} /> Zero persistent file storage</span>
              <div className="upload-actions">
                <button className="secondary-button" onClick={() => setShowUpload(false)} disabled={isAnalyzing}>Cancel</button>
                <button className="lime-button" onClick={startAnalysis} disabled={!selectedFile || isAnalyzing}>
                  {isAnalyzing ? <><Loader2 size={15} className="animate-spin" /> Analyzing...</> : <><Sparkles size={15} /> Run Intelligence Scan</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <DocumentProvider>
      <AppContent />
    </DocumentProvider>
  );
}
