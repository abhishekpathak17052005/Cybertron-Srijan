import TaskReminder from "../models/TaskReminder.js";
import { verifyActionToken, generateActionToken } from "../utils/tokenGenerator.js";
import { cancelTaskJobs, scheduleTaskReminders } from "../config/agenda.js";
import { isConnected } from "../config/db.js";
import { nanoid } from "nanoid";

// Memory storage fallback for tasks when DB is offline
const memoryTasks = new Map();

/**
 * GET /api/tasks/action
 * Handles one-click HMAC action URLs from emails: ?taskId=...&action=done|snooze&token=...
 */
export async function handleAction(req, res) {
  const { taskId, action, token, hours = 24 } = req.query;

  // 1. Verify HMAC cryptographic signature
  const isValid = verifyActionToken(taskId, action, token);
  if (!isValid) {
    return res.status(403).send(renderActionHtml({
      title: "Action Verification Failed",
      message: "This action link is invalid, altered, or expired.",
      status: "ERROR",
    }));
  }

  let taskDoc = null;
  if (isConnected()) {
    try {
      taskDoc = await TaskReminder.findById(taskId);
    } catch (e) {
      console.warn(e.message);
    }
  }

  if (!taskDoc) {
    taskDoc = memoryTasks.get(taskId) || {
      _id: taskId,
      task: { title: "Contractual Obligation" },
      status: "PENDING",
    };
  }

  // 2. Process Action
  if (action === "done") {
    taskDoc.status = "COMPLETED";
    if (isConnected() && taskDoc.save) {
      await taskDoc.save();
      await cancelTaskJobs(taskId);
    } else {
      memoryTasks.set(taskId, taskDoc);
    }

    return res.send(renderActionHtml({
      title: "Task Marked as Completed",
      message: `The obligation "<strong>${taskDoc.task.title}</strong>" has been recorded as satisfied. Remaining email dispatches have been cancelled.`,
      status: "COMPLETED",
      taskTitle: taskDoc.task.title,
    }));
  }

  if (action === "snooze") {
    const snoozeHours = Number(hours) || 24;
    const snoozedUntil = new Date(Date.now() + snoozeHours * 60 * 60 * 1000);
    taskDoc.status = "SNOOZED";
    taskDoc.snoozedUntil = snoozedUntil;

    if (isConnected() && taskDoc.save) {
      await taskDoc.save();
    } else {
      memoryTasks.set(taskId, taskDoc);
    }

    return res.send(renderActionHtml({
      title: `Reminder Snoozed for ${snoozeHours} Hours`,
      message: `We will nudge you again on <strong>${snoozedUntil.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</strong> regarding "${taskDoc.task.title}".`,
      status: "SNOOZED",
      taskTitle: taskDoc.task.title,
    }));
  }

  return res.status(400).send(renderActionHtml({
    title: "Unknown Action",
    message: "Requested action is not supported.",
    status: "ERROR",
  }));
}

/**
 * GET /api/tasks
 * Return tasks for active session or all tasks
 */
export async function getTasks(req, res) {
  const { sessionId } = req.query;

  if (isConnected()) {
    try {
      const query = sessionId ? { sessionId } : {};
      const tasks = await TaskReminder.find(query).sort({ "task.deadline": 1 }).lean();
      if (tasks.length > 0) {
        return res.json({
          success: true,
          tasks: tasks.map(formatTaskResponse),
        });
      }
    } catch (err) {
      console.warn("⚠️ [Tasks] DB query error:", err.message);
    }
  }

  const memoryList = Array.from(memoryTasks.values()).filter(
    (t) => !sessionId || t.sessionId === sessionId
  );

  if (memoryList.length > 0) {
    return res.json({ success: true, tasks: memoryList.map(formatTaskResponse) });
  }

  // Default seed tasks for demo workspace
  const demoTasks = [
    {
      id: "task_demo_1",
      title: "Serve 60-day termination notice",
      clause: "Clause 12 · Page 5",
      date: "30 JAN 2027",
      time: "18:30 IST",
      impact: "₹20,000 penalty if missed",
      tone: "coral",
      status: "PENDING",
    },
    {
      id: "task_demo_2",
      title: "Confirm renewal decision",
      clause: "Clause 07 · Page 4",
      date: "01 DEC 2026",
      time: "09:00 IST",
      impact: "Renewal window opens",
      tone: "amber",
      status: "PENDING",
    },
    {
      id: "task_demo_3",
      title: "Request deposit return inspection",
      clause: "Clause 18 · Page 7",
      date: "01 MAR 2027",
      time: "10:00 IST",
      impact: "₹25,000 deposit recovery",
      tone: "lime",
      status: "SCHEDULED",
    },
  ];

  return res.json({ success: true, tasks: demoTasks });
}

/**
 * POST /api/tasks
 * Create custom reminder from UI
 */
export async function createTask(req, res) {
  const { sessionId = "sess_custom", title, deadline, clauseRef, recipientEmail } = req.body;

  if (!title || !deadline) {
    return res.status(400).json({ success: false, error: "Title and deadline are required." });
  }

  const deadlineDate = new Date(deadline);
  const tempId = `task_${Date.now()}_${nanoid(6)}`;

  const doneToken = generateActionToken(tempId, "done");
  const snoozeToken = generateActionToken(tempId, "snooze");

  const tTime = deadlineDate.getTime();
  const schedule = [
    { type: "3_DAYS_BEFORE", runAt: new Date(tTime - 72 * 60 * 60 * 1000), sent: false },
    { type: "1_DAY_BEFORE", runAt: new Date(tTime - 24 * 60 * 60 * 1000), sent: false },
    { type: "5_HOURS_BEFORE", runAt: new Date(tTime - 5 * 60 * 60 * 1000), sent: false },
  ];

  const taskData = {
    sessionId,
    recipientEmail: recipientEmail || process.env.SMTP_USER || "user@example.com",
    documentName: "User Created Milestone",
    task: {
      title,
      clauseRef: clauseRef || "User Milestone",
      description: "Custom task added from LegalLens Radar",
      deadline: deadlineDate,
      financialImpact: "Operational compliance deadline",
    },
    schedule,
    status: "PENDING",
    actionTokens: { doneToken, snoozeToken },
  };

  if (isConnected()) {
    try {
      const taskDoc = new TaskReminder(taskData);
      taskDoc.actionTokens.doneToken = generateActionToken(taskDoc._id.toString(), "done");
      taskDoc.actionTokens.snoozeToken = generateActionToken(taskDoc._id.toString(), "snooze");
      await taskDoc.save();
      await scheduleTaskReminders(taskDoc);
      return res.status(201).json({ success: true, task: formatTaskResponse(taskDoc) });
    } catch (err) {
      console.warn(err.message);
    }
  }

  const memoryItem = { ...taskData, _id: tempId };
  memoryTasks.set(tempId, memoryItem);

  return res.status(201).json({ success: true, task: formatTaskResponse(memoryItem) });
}

/**
 * PATCH /api/tasks/:id/toggle
 * Toggle completed state from the frontend UI
 */
export async function toggleTask(req, res) {
  const { id } = req.params;

  if (isConnected()) {
    try {
      const taskDoc = await TaskReminder.findById(id);
      if (taskDoc) {
        taskDoc.status = taskDoc.status === "COMPLETED" ? "PENDING" : "COMPLETED";
        await taskDoc.save();
        if (taskDoc.status === "COMPLETED") {
          await cancelTaskJobs(id);
        }
        return res.json({ success: true, task: formatTaskResponse(taskDoc) });
      }
    } catch (e) {
      console.warn(e.message);
    }
  }

  const memTask = memoryTasks.get(id);
  if (memTask) {
    memTask.status = memTask.status === "COMPLETED" ? "PENDING" : "COMPLETED";
    memoryTasks.set(id, memTask);
    return res.json({ success: true, task: formatTaskResponse(memTask) });
  }

  // If toggling a demo task
  return res.json({
    success: true,
    task: { id, status: "COMPLETED" },
  });
}

function formatTaskResponse(st) {
  const id = st._id ? st._id.toString() : st.id;
  const deadline = st.task?.deadline ? new Date(st.task.deadline) : new Date();
  return {
    id,
    title: st.task?.title || "Contract Task",
    clause: st.task?.clauseRef || "General",
    date: deadline.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).toUpperCase(),
    time: deadline.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }) + " IST",
    impact: st.task?.financialImpact || "Notice requirement",
    tone: st.task?.title?.toLowerCase().includes("termination") ? "coral" : "amber",
    status: st.status || "PENDING",
  };
}

function renderActionHtml({ title, message, status, taskTitle }) {
  const isSuccess = status === "COMPLETED" || status === "SNOOZED";
  const badgeColor = isSuccess ? "#bef264" : "#f87171";
  const badgeBg = isSuccess ? "rgba(190, 242, 100, 0.15)" : "rgba(248, 113, 113, 0.15)";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — LegalLens</title>
  <style>
    body { margin: 0; background: #0b0f17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #e6edf3; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #131926; border: 1px solid #1f293d; border-radius: 16px; padding: 40px; max-width: 480px; width: 100%; box-shadow: 0 20px 50px rgba(0,0,0,0.5); text-align: center; }
    .icon { width: 54px; height: 54px; border-radius: 50%; background: ${badgeBg}; color: ${badgeColor}; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; margin-bottom: 20px; border: 1px solid ${badgeColor}; }
    h1 { font-size: 22px; margin: 0 0 12px 0; color: #ffffff; letter-spacing: -0.4px; }
    p { font-size: 14px; color: #8b949e; line-height: 1.6; margin: 0 0 28px 0; }
    .btn { display: inline-block; background: #bef264; color: #0a0e18; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; }
    .seal { margin-top: 30px; font-size: 12px; color: #484f58; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isSuccess ? "✓" : "✕"}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="${process.env.FRONTEND_URL || "http://localhost:3000"}" class="btn">Open LegalLens Workspace</a>
    <div class="seal">LegalLens Zero-Persistent Document Intelligence · Ephemeral Session</div>
  </div>
</body>
</html>
  `;
}

export default { handleAction, getTasks, createTask, toggleTask };
