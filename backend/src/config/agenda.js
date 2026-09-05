import dns from "node:dns";
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {}

import Agenda from "agenda";
import { sendDeadlineNotification } from "../services/notificationService.js";
import TaskReminder from "../models/TaskReminder.js";
import { isConnected } from "./db.js";

let agenda = null;

export async function initAgenda() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri || !isConnected()) {
    console.warn("⚠️  [Agenda] MongoDB is offline or MONGODB_URI not found. Agenda job runner disabled (local timers fallback).");
    return null;
  }

  try {
    agenda = new Agenda({
      db: { address: mongoUri, collection: "agenda_jobs" },
      maxConcurrency: 10,
      defaultLockLifetime: 10000,
    });

    agenda.on("error", (err) => {
      console.warn("⚠️  [Agenda] Background scheduler notice:", err.message);
    });

    // Define the reminder job
    agenda.define("send-deadline-reminder", async (job) => {
      const { taskReminderId, scheduleType } = job.attrs.data || {};
      if (!taskReminderId) return;

      try {
        const taskReminder = await TaskReminder.findById(taskReminderId);
        if (!taskReminder || taskReminder.status === "COMPLETED") {
          console.log(`[Agenda] Task ${taskReminderId} is completed or missing. Skipping reminder.`);
          return;
        }

        console.log(`⏰ [Agenda] Triggering ${scheduleType} notification for task: ${taskReminder.task.title}`);
        await sendDeadlineNotification({ taskReminder, scheduleType });

        // Mark this schedule stage as sent
        const scheduleEntry = taskReminder.schedule.find((s) => s.type === scheduleType);
        if (scheduleEntry) {
          scheduleEntry.sent = true;
          await taskReminder.save();
        }
      } catch (err) {
        console.error("❌ [Agenda] Error executing reminder job:", err.message);
      }
    });

    await agenda.start();
    console.log("✅ [Agenda] Background deadline scheduler started.");
    return agenda;
  } catch (error) {
    console.error("❌ [Agenda] Failed to initialize Agenda scheduler:", error.message);
    return null;
  }
}

/**
 * Schedule automated T-72h, T-24h, and T-5h email reminders for a task
 */
export async function scheduleTaskReminders(taskReminder) {
  if (!taskReminder || !taskReminder.schedule) return;

  for (const item of taskReminder.schedule) {
    const runAt = new Date(item.runAt);
    const now = new Date();

    if (agenda) {
      try {
        // If runAt is in the past, don't schedule or schedule immediately if within last 5 minutes
        if (runAt > now) {
          const job = agenda.create("send-deadline-reminder", {
            taskReminderId: taskReminder._id.toString(),
            scheduleType: item.type,
          });
          job.schedule(runAt);
          await job.save();
          item.jobId = job.attrs._id.toString();
        }
      } catch (err) {
        console.warn(`⚠️ [Agenda] Could not schedule job for ${item.type}:`, err.message);
      }
    } else {
      // Local fallback using setTimeout if within 24 hours
      const diffMs = runAt.getTime() - now.getTime();
      if (diffMs > 0 && diffMs < 86400000) {
        setTimeout(async () => {
          try {
            console.log(`⏰ [Fallback Scheduler] Triggering ${item.type} notification for: ${taskReminder.task.title}`);
            await sendDeadlineNotification({ taskReminder, scheduleType: item.type });
          } catch (e) {
            console.error(e);
          }
        }, diffMs);
      }
    }
  }

  await taskReminder.save();
}

/**
 * Cancel pending Agenda jobs for a task
 */
export async function cancelTaskJobs(taskId) {
  if (!agenda || !taskId) return;
  try {
    const numRemoved = await agenda.cancel({ "data.taskReminderId": taskId.toString() });
    console.log(`[Agenda] Cancelled ${numRemoved} pending jobs for task ${taskId}`);
  } catch (err) {
    console.warn("[Agenda] Error cancelling jobs:", err.message);
  }
}

export function getAgenda() {
  return agenda;
}

export default { initAgenda, scheduleTaskReminders, cancelTaskJobs, getAgenda };
