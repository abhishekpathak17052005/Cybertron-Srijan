import { sendEmail } from "../config/mailer.js";

/**
 * Format and dispatch an email reminder with one-click HMAC actions
 */
export async function sendDeadlineNotification({ taskReminder, scheduleType }) {
  if (!taskReminder || taskReminder.status === "COMPLETED") {
    return { skipped: true, reason: "Task already completed" };
  }

  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  const taskId = taskReminder._id.toString();
  const { task, actionTokens, recipientEmail, documentName } = taskReminder;

  const doneUrl = `${baseUrl}/api/tasks/action?taskId=${taskId}&action=done&token=${actionTokens.doneToken}`;
  const snoozeUrl = `${baseUrl}/api/tasks/action?taskId=${taskId}&action=snooze&hours=24&token=${actionTokens.snoozeToken}`;

  const deadlineFormatted = new Date(task.deadline).toLocaleString("en-IN", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  });

  const stageLabel =
    scheduleType === "3_DAYS_BEFORE"
      ? "3 Days Remaining"
      : scheduleType === "1_DAY_BEFORE"
      ? "1 Day Remaining (Urgent)"
      : scheduleType === "5_HOURS_BEFORE"
      ? "5 Hours Remaining (Final Notice)"
      : "Upcoming Milestone";

  const subject = `[LegalLens Alert] ${stageLabel}: ${task.title}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0b0f17; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e6edf3; }
    .container { max-width: 580px; margin: 30px auto; background: #131926; border: 1px solid #1f293d; border-radius: 14px; overflow: hidden; }
    .header { background: #0f1522; padding: 24px 30px; border-bottom: 1px solid #1f293d; display: flex; align-items: center; justify-content: space-between; }
    .brand { font-size: 17px; font-weight: 700; color: #bef264; letter-spacing: -0.5px; }
    .badge { font-size: 11px; background: rgba(248, 113, 113, 0.15); color: #f87171; padding: 4px 10px; border-radius: 9999px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid rgba(248, 113, 113, 0.3); }
    .content { padding: 30px; }
    .title { font-size: 21px; font-weight: 700; color: #ffffff; margin: 0 0 10px 0; line-height: 1.3; }
    .doc-ref { font-size: 13px; color: #8b949e; margin-bottom: 24px; }
    .info-box { background: #0a0e18; border: 1px solid #1e2638; border-radius: 10px; padding: 18px 20px; margin-bottom: 24px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 13px; }
    .info-row:last-child { margin-bottom: 0; }
    .info-label { color: #8b949e; }
    .info-value { color: #ffffff; font-weight: 600; }
    .penalty-box { background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; padding: 14px 18px; border-radius: 0 8px 8px 0; margin-bottom: 28px; }
    .penalty-title { font-size: 12px; font-weight: 700; color: #f87171; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .penalty-text { font-size: 14px; color: #fca5a5; margin: 0; font-weight: 500; }
    .actions { display: flex; gap: 12px; margin-bottom: 20px; }
    .btn-done { display: inline-block; background: #bef264; color: #0a0e18; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; text-align: center; }
    .btn-snooze { display: inline-block; background: #1f293d; color: #e6edf3; text-decoration: none; padding: 12px 20px; border-radius: 8px; font-weight: 600; font-size: 14px; text-align: center; border: 1px solid #2e3b52; }
    .footer { background: #0c101a; padding: 20px 30px; font-size: 12px; color: #6e7681; border-top: 1px solid #1f293d; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="brand">LegalLens · Deadline Radar</span>
      <span class="badge">${stageLabel}</span>
    </div>
    <div class="content">
      <h1 class="title">${task.title}</h1>
      <div class="doc-ref">Originating from <strong>${documentName}</strong> · ${task.clauseRef || "Contract Obligation"}</div>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Contract Deadline:</span>
          <span class="info-value">${deadlineFormatted}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Clause Reference:</span>
          <span class="info-value">${task.clauseRef || "N/A"}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Action Required:</span>
          <span class="info-value">${task.description || "Take contractual action"}</span>
        </div>
      </div>

      ${
        task.financialImpact
          ? `
      <div class="penalty-box">
        <div class="penalty-title">Financial Exposure if Missed</div>
        <p class="penalty-text">${task.financialImpact}</p>
      </div>`
          : ""
      }

      <p style="font-size: 14px; color: #8b949e; line-height: 1.5; margin-bottom: 24px;">
        Use the one-click actions below to update your status instantly without logging in:
      </p>

      <div class="actions">
        <a href="${doneUrl}" class="btn-done">✓ Mark as Done</a>
        <a href="${snoozeUrl}" class="btn-snooze">⏰ Remind in 24 Hours</a>
      </div>
    </div>
    <div class="footer">
      This notification was scheduled by LegalLens under zero-persistent document storage guidelines.
      Your document was parsed in-memory and will automatically expire from the ephemeral session cache.
    </div>
  </div>
</body>
</html>
`;

  return await sendEmail({
    to: recipientEmail,
    subject,
    html,
  });
}

export default { sendDeadlineNotification };
