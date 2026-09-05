import { useMemo, useState } from "react";
import {
  Bell,
  CalendarClock,
  Check,
  Clock3,
  Mail,
  MoreHorizontal,
  Plus,
  Send,
  ShieldCheck,
} from "lucide-react";
import { useDocument } from "../contexts/DocumentContext";

export default function Reminders() {
  const { tasks, toggleTaskStatus, addNewTask } = useDocument();

  const [showComposer, setShowComposer] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newClause, setNewClause] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeCount = useMemo(
    () => tasks.filter((t) => t.status !== "COMPLETED").length,
    [tasks]
  );
  const completedCount = useMemo(
    () => tasks.filter((t) => t.status === "COMPLETED").length,
    [tasks]
  );
  const scheduledEmailsCount = activeCount * 3;

  const handleCreateReminder = async () => {
    if (!newTitle.trim() || !newDeadline) {
      alert("Please provide both a task title and a deadline.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addNewTask(newTitle, newDeadline, newClause || "Contract Milestone");
      setShowComposer(false);
      setNewTitle("");
      setNewClause("");
      setNewDeadline("");
    } catch (err: any) {
      alert(err.message || "Failed to create reminder");
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextActiveTask = tasks.find((t) => t.status !== "COMPLETED") || tasks[0];

  return (
    <div className="page-content page-enter">
      <div className="page-header">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" /> DEADLINE RADAR
          </div>
          <h1>
            Stay ahead of <span className="lime-dot">the clock.</span>
          </h1>
          <p>
            Automated multi-stage notification sequence (T−72h, T−24h, T−5h) with one-click HMAC resolution.
          </p>
        </div>
        <button className="lime-button" onClick={() => setShowComposer(true)}>
          <Plus size={16} /> Add reminder
        </button>
      </div>

      <div className="reminder-overview">
        <div className="reminder-hero-stat">
          <span className="summary-label">NEXT DEADLINE</span>
          <strong>
            {nextActiveTask ? nextActiveTask.date.slice(0, 6) : "ALL CLEAR"}
          </strong>
          <p>{nextActiveTask?.title || "No pending contractual deadlines"}</p>
          <span className="reminder-date">
            {nextActiveTask?.date} · {nextActiveTask?.time}
          </span>
        </div>
        <div className="reminder-mini-stats">
          <div>
            <CalendarClock size={17} />
            <span>{activeCount < 10 ? `0${activeCount}` : activeCount}</span>
            <small>Active tasks</small>
          </div>
          <div>
            <Send size={17} />
            <span>{scheduledEmailsCount < 10 ? `0${scheduledEmailsCount}` : scheduledEmailsCount}</span>
            <small>Emails scheduled</small>
          </div>
          <div>
            <Check size={17} />
            <span>{completedCount < 10 ? `0${completedCount}` : completedCount}</span>
            <small>Completed</small>
          </div>
        </div>
      </div>

      <div className="reminder-layout">
        <section className="panel task-panel">
          <div className="panel-heading">
            <div>
              <span className="section-kicker">UPCOMING OBLIGATIONS</span>
              <h2>Task timeline</h2>
            </div>
            <button className="panel-menu" aria-label="Timeline menu">
              <MoreHorizontal size={18} />
            </button>
          </div>

          <div className="task-list">
            {tasks.map((task) => {
              const isDone = task.status === "COMPLETED";
              return (
                <div
                  className={`task-card ${isDone ? "completed" : ""}`}
                  key={task.id}
                >
                  <div className={`task-marker ${isDone ? "" : task.tone}`} />
                  <div className="task-main">
                    <div className="task-date-row">
                      <span>
                        {task.date} · {task.time}
                      </span>
                      <span
                        className={`task-status ${
                          isDone ? "complete" : task.status?.toLowerCase()
                        }`}
                      >
                        {task.status}
                      </span>
                    </div>
                    <h3>{task.title}</h3>
                    <p>{task.clause}</p>
                    <div className="task-impact">
                      <span>Financial impact</span>
                      <strong>{task.impact}</strong>
                    </div>
                  </div>
                  <button
                    className={`task-check ${isDone ? "done" : ""}`}
                    onClick={() => toggleTaskStatus(task.id)}
                    aria-label={isDone ? "Mark Pending" : "Mark Done"}
                  >
                    {isDone ? <Check size={15} /> : <span />}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="panel schedule-panel">
          <div className="section-kicker">NOTIFICATION ENGINE</div>
          <h2>Every deadline, covered.</h2>
          <p className="schedule-copy">
            LegalLens dispatches 3 calibrated reminders directly to your inbox with one-click HMAC action URLs:
          </p>

          <div className="schedule-steps">
            <div>
              <span>T − 72H</span>
              <strong>3 days before</strong>
              <small>Preparation reminder & notice verification</small>
            </div>
            <div>
              <span>T − 24H</span>
              <strong>1 day before</strong>
              <small>Action execution nudge</small>
            </div>
            <div>
              <span>T − 05H</span>
              <strong>5 hours before</strong>
              <small>Final window alert before default</small>
            </div>
          </div>

          <div className="email-card">
            <div className="email-icon">
              <Mail size={17} />
            </div>
            <div>
              <strong>om.mehta@example.com</strong>
              <span>Verified delivery address</span>
            </div>
            <Check size={15} className="email-check" />
          </div>

          <div className="schedule-privacy">
            <ShieldCheck size={14} /> HMAC-SHA256 secured one-click actions
          </div>
        </aside>
      </div>

      {showComposer && (
        <div className="modal-backdrop" onClick={() => setShowComposer(false)}>
          <div
            className="upload-modal reminder-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" onClick={() => setShowComposer(false)}>
              ×
            </button>
            <div className="modal-eyebrow">
              <Bell size={14} /> Custom deadline radar reminder
            </div>
            <h2>Set a new contract nudge.</h2>
            <p>
              Connect a deadline to a clause and LegalLens will automatically schedule the 3-stage reminder sequence.
            </p>

            <label className="form-label">
              Task title *
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Request written renewal confirmation"
                disabled={isSubmitting}
              />
            </label>

            <label className="form-label">
              Clause reference (optional)
              <input
                value={newClause}
                onChange={(e) => setNewClause(e.target.value)}
                placeholder="e.g. Clause 07 · Page 4"
                disabled={isSubmitting}
              />
            </label>

            <label className="form-label">
              Contractual Deadline *
              <input
                type="datetime-local"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
                disabled={isSubmitting}
              />
            </label>

            <div className="modal-footer">
              <span>
                <Clock3 size={14} /> T-72h, T-24h & T-5h dispatches enabled
              </span>
              <button
                className="lime-button"
                onClick={handleCreateReminder}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Scheduling..." : "Create reminder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
