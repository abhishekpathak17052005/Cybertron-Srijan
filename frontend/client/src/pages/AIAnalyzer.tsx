import { FormEvent, useMemo, useState } from "react";
import { Bot, Check, FileText, MessageSquarePlus, MoreHorizontal, Pencil, Plus, Send, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = { role: "user" | "assistant"; text: string };
type Chat = { id: number; title: string; messages: Message[]; updated: string };

const initialChats: Chat[] = [
  {
    id: 1,
    title: "Termination notice risk",
    updated: "Today",
    messages: [
      { role: "user", text: "What happens if I miss the termination notice window?" },
      { role: "assistant", text: "Clause 12 requires 60 days written notice. If that window is missed, Clause 21 may trigger the ₹20,000 early exit penalty. The agreement does not state a grace period." },
    ],
  },
  {
    id: 2,
    title: "Deposit return timeline",
    updated: "Yesterday",
    messages: [{ role: "user", text: "When should I expect my security deposit back?" }, { role: "assistant", text: "Clause 18 opens a 30-day return window after the agreement ends, subject to permitted deductions for damage or unpaid dues." }],
  },
];

function makeTitle(prompt: string) {
  const cleanPrompt = prompt.replace(/[?!.]+$/, "").trim();
  return cleanPrompt.length > 34 ? `${cleanPrompt.slice(0, 34).trim()}…` : cleanPrompt || "New contract chat";
}

function answerFor(prompt: string) {
  const normalized = prompt.toLowerCase();
  if (normalized.includes("deposit")) return "Clause 18 says the deposit may be reduced for structural damage, unpaid dues, or restoration beyond ordinary wear. The return window is 30 days after the agreement ends.";
  if (normalized.includes("rent") || normalized.includes("payment")) return "Clause 04 sets monthly rent at ₹25,000, due on or before the fifth day of each calendar month.";
  if (normalized.includes("renew")) return "Clause 07 allows renewal by mutual written consent at least 30 days before expiry. The agreement does not create an automatic renewal right.";
  return "I found a connected answer across Clauses 12 and 21: the agreement requires 60 days written notice, and missing that window can create a ₹20,000 early-exit exposure."
}

export default function AIAnalyzer() {
  const [chats, setChats] = useState(initialChats);
  const [activeId, setActiveId] = useState(1);
  const [prompt, setPrompt] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const activeChat = chats.find((chat) => chat.id === activeId) ?? chats[0];

  const groupedChats = useMemo(() => chats.reduce<Record<string, Chat[]>>((groups, chat) => {
    const key = chat.updated === "Today" ? "Today" : "Earlier";
    groups[key] = [...(groups[key] ?? []), chat];
    return groups;
  }, {}), [chats]);

  const createChat = () => {
    const nextChat = { id: Date.now(), title: "New contract chat", updated: "Today", messages: [] };
    setChats((current) => [nextChat, ...current]);
    setActiveId(nextChat.id);
    setPrompt("");
  };

  const sendPrompt = (event: FormEvent) => {
    event.preventDefault();
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || !activeChat) return;
    const isFirstMessage = activeChat.messages.length === 0;
    setChats((current) => current.map((chat) => chat.id === activeChat.id ? {
      ...chat,
      title: isFirstMessage ? makeTitle(cleanPrompt) : chat.title,
      updated: "Today",
      messages: [...chat.messages, { role: "user", text: cleanPrompt }, { role: "assistant", text: answerFor(cleanPrompt) }],
    } : chat));
    setPrompt("");
  };

  const saveTitle = () => {
    const title = editingTitle.trim();
    if (editingId && title) setChats((current) => current.map((chat) => chat.id === editingId ? { ...chat, title } : chat));
    setEditingId(null);
  };

  const deleteChat = () => {
    if (!deleteId) return;
    const remaining = chats.filter((chat) => chat.id !== deleteId);
    setChats(remaining);
    setActiveId(remaining[0]?.id ?? 0);
    setDeleteId(null);
  };

  return (
    <div className="ai-page page-content page-enter">
      <aside className="ai-history panel">
        <div className="ai-history-header"><div><span className="section-kicker">AI ANALYZER</span><h2>Your chats</h2></div><button className="icon-button" onClick={createChat} aria-label="Start a new chat" title="Start a new chat"><MessageSquarePlus size={16} /></button></div>
        <Button className="ai-new-chat" onClick={createChat}><Plus size={15} /> New chat</Button>
        <div className="ai-history-list">
          {Object.entries(groupedChats).map(([group, groupChats]) => <div className="ai-history-group" key={group}><span className="ai-history-label">{group}</span>{groupChats.map((chat) => <div className={`ai-chat-row ${chat.id === activeId ? "active" : ""}`} key={chat.id}>
            {editingId === chat.id ? <input autoFocus value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} onBlur={saveTitle} onKeyDown={(event) => { if (event.key === "Enter") saveTitle(); if (event.key === "Escape") setEditingId(null); }} /> : <button className="ai-chat-select" onClick={() => setActiveId(chat.id)}><MessageSquarePlus size={14} /><span>{chat.title}</span></button>}
            <div className="ai-chat-actions"><button onClick={() => { setEditingId(chat.id); setEditingTitle(chat.title); }} aria-label={`Rename ${chat.title}`} title="Rename chat"><Pencil size={12} /></button><button onClick={() => setDeleteId(chat.id)} aria-label={`Delete ${chat.title}`} title="Delete chat"><Trash2 size={12} /></button></div>
          </div>)}</div>)}
          {chats.length === 0 && <div className="ai-empty-history"><MessageSquarePlus size={18} /><span>No saved chats yet.</span></div>}
        </div>
        <div className="ai-history-footer"><ShieldCheck size={14} /><span>Chats stay in this session</span></div>
      </aside>

      <section className="ai-conversation">
        <div className="ai-page-header"><div><div className="eyebrow"><span className="eyebrow-line" /> GROUNDED DOCUMENT ANALYSIS</div><h1>Ask your contract <span className="lime-dot">anything.</span></h1><p>Trace obligations, risk, and consequences with answers grounded in your uploaded agreement.</p></div><div className="ai-status"><i /> Analyzer live</div></div>
        <div className="ai-chat-panel panel">
          <div className="ai-chat-toolbar"><div className="ai-chat-heading"><div className="ai-bot-icon"><Bot size={17} /></div><div><strong>{activeChat?.title ?? "New contract chat"}</strong><span>LegalLens copilot · 0.94 confidence</span></div></div><button className="panel-menu" aria-label="Chat options"><MoreHorizontal size={18} /></button></div>
          <div className="ai-messages">
            {activeChat?.messages.length ? activeChat.messages.map((message, index) => <div className={`ai-message ${message.role}`} key={`${message.role}-${index}`}><div className="ai-message-avatar">{message.role === "assistant" ? <Sparkles size={13} /> : "OM"}</div><div><span className="ai-message-label">{message.role === "assistant" ? "LEGAL LENS" : "YOU"}</span><p>{message.text}</p>{message.role === "assistant" && <div className="ai-citations"><span><FileText size={11} /> CLAUSE 12 · P. 5</span><span><FileText size={11} /> CLAUSE 21 · P. 8</span></div>}</div></div>) : <div className="ai-welcome"><div className="ai-welcome-orb"><Sparkles size={22} /></div><h2>Start a grounded conversation.</h2><p>Ask about a deadline, a fee, a right, or any sentence that feels unclear.</p><div className="ai-prompts"><button onClick={() => setPrompt("What happens if I leave before the lease ends?")}>Early exit scenario <ArrowIcon /></button><button onClick={() => setPrompt("When do I get my deposit back?")}>Deposit timeline <ArrowIcon /></button><button onClick={() => setPrompt("Which clauses are landlord-biased?")}>Bias check <ArrowIcon /></button></div></div>}
          </div>
          <form className="ai-composer" onSubmit={sendPrompt}><Input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask about your agreement…" aria-label="Ask the AI Analyzer" /><Button type="submit" size="icon" className="ai-send" aria-label="Send message"><Send size={16} /></Button></form>
          <div className="ai-composer-note"><Check size={13} /> Answers cite the clauses they use · New chats are named automatically from your first question</div>
        </div>
      </section>

      {deleteId && <div className="ai-delete-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-chat-title"><div className="ai-delete-dialog"><button className="modal-close" onClick={() => setDeleteId(null)} aria-label="Close"><X size={16} /></button><div className="ai-delete-icon"><Trash2 size={17} /></div><h2 id="delete-chat-title">Delete this chat?</h2><p>This removes the conversation and its name from this session.</p><div className="ai-delete-actions"><button className="secondary-button" onClick={() => setDeleteId(null)}>Keep chat</button><button className="delete-button" onClick={deleteChat}>Delete chat</button></div></div></div>}
    </div>
  );
}

function ArrowIcon() { return <span className="ai-prompt-arrow">→</span>; }
