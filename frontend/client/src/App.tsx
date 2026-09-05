import { useEffect, useRef, useState } from "react";
import { Bell, Bot, ChevronDown, Command, FileText, LayoutDashboard, Network, Settings2, ShieldCheck, Sparkles, UploadCloud } from "lucide-react";
import AIAnalyzer from "./pages/AIAnalyzer";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import ClauseIntelligence from "./pages/ClauseIntelligence";
import ClauseGraph from "./pages/ClauseGraph";
import Landing from "./pages/Landing";
import Reminders from "./pages/Reminders";
import Settings from "./pages/Settings";

const navItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Clause intelligence", icon: FileText },
  { label: "Clause graph", icon: Network },
];

export default function App() {
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
  const [uploadMessage, setUploadMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const handleFile = (file?: File) => {
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setSelectedFile(null);
      setUploadMessage("That file is larger than the 25 MB limit.");
      return;
    }

    setSelectedFile(file);
    setUploadMessage("Ready for analysis when the document service is connected.");
  };

  const closeUpload = () => {
    setShowUpload(false);
    setSelectedFile(null);
    setUploadMessage("");
  };

  const navigate = (label: string) => {
    const nextPath = label === "Overview" ? "/workspace" : `/${label.toLowerCase().replaceAll(" ", "-")}`;
    setActiveNav(label);
    setCurrentPath(nextPath);
    window.history.pushState({}, "", nextPath);
  };

  if (currentPath === "/") return <Landing />;
  if (currentPath === "/login") return <Auth mode="login" />;
  if (currentPath === "/register") return <Auth mode="register" />;

  const page = activeNav === "AI Analyzer" ? <AIAnalyzer />
    : activeNav === "Clause intelligence" ? <ClauseIntelligence />
    : activeNav === "Clause graph" ? <ClauseGraph />
    : activeNav === "Reminders" ? <Reminders />
    : activeNav === "Settings" ? <Settings />
    : <Home onUpload={() => setShowUpload(true)} />;

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

        <div className="workspace-switcher">
          <div className="workspace-avatar">OM</div>
          <div className="workspace-copy">
            <span>Om Workspace</span>
            <small>Personal workspace</small>
          </div>
          <ChevronDown size={15} className="muted-icon" />
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          <span className="nav-section-label">Workspace</span>
          {navItems.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={`nav-item ${activeNav === label ? "active" : ""}`}
              onClick={() => navigate(label)}
            >
              <Icon size={16} strokeWidth={1.9} />
              <span>{label}</span>
              {label === "Clause graph" && <span className="nav-count">24</span>}
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
            <span className="nav-dot" />
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="privacy-seal">
            <div className="privacy-icon"><ShieldCheck size={15} /></div>
            <div>
              <strong>Private by design</strong>
              <span>Session expires in 23h 42m</span>
            </div>
          </div>
          <button className={`nav-item settings-item ${activeNav === "Settings" ? "active" : ""}`} onClick={() => navigate("Settings")}>
            <Settings2 size={16} strokeWidth={1.9} />
            <span>Settings</span>
          </button>
          <div className="user-row">
            <div className="user-avatar">OM</div>
            <div className="user-copy"><strong>Om Mehta</strong><span>Owner</span></div>
            <Command size={14} className="muted-icon" />
          </div>
        </div>
      </aside>

      <main className="main-canvas">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{activeNav}</strong></div>
          <div className="topbar-actions">
            <button className="search-trigger" onClick={() => window.alert("Search is ready for connected document data.")}><Command size={14} /><span>Search anywhere</span><kbd>⌘ K</kbd></button>
            <button className="icon-button" aria-label="Notifications" onClick={() => window.alert("You have 3 active deadline reminders.")}><Bell size={17} /><span className="notification-pip" /></button>
            <button className="top-avatar">OM</button>
          </div>
        </header>
        {page}
      </main>

      {showUpload && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="upload-title" onClick={closeUpload}>
          <div className="upload-modal" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={closeUpload} aria-label="Close">×</button>
            <div className="modal-eyebrow"><Sparkles size={14} /> New analysis</div>
            <h2 id="upload-title">Bring a contract into focus.</h2>
            <p>Drop a PDF, DOCX, or image here. Your document stays in memory and is automatically purged after the session.</p>
            <input
              ref={fileInputRef}
              className="file-input"
              type="file"
              accept=".pdf,.docx,image/png,image/jpeg"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            <button
              className="dropzone"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleFile(event.dataTransfer.files[0]);
              }}
            >
              <UploadCloud size={28} />
              <strong>{selectedFile ? selectedFile.name : "Drop your document here"}</strong>
              <span>{selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB · selected` : "PDF, DOCX, PNG or JPG · max 25 MB"}</span>
            </button>
            {uploadMessage && <p className="upload-message" role="status">{uploadMessage}</p>}
            <div className="modal-footer"><span><ShieldCheck size={14} /> No persistent file storage</span><button className="secondary-button" onClick={closeUpload}>Cancel</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
