import mongoose from "mongoose";

const taskReminderSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    recipientEmail: {
      type: String,
      required: true,
    },
    documentName: {
      type: String,
      default: "Document",
    },
    task: {
      title: {
        type: String,
        required: true,
      },
      clauseRef: {
        type: String,
        default: "",
      },
      description: {
        type: String,
        default: "",
      },
      deadline: {
        type: Date,
        required: true,
      },
      financialImpact: {
        type: String,
        default: "",
      },
    },
    schedule: [
      {
        type: {
          type: String,
          enum: ["3_DAYS_BEFORE", "1_DAY_BEFORE", "5_HOURS_BEFORE", "CUSTOM"],
          default: "CUSTOM",
        },
        runAt: {
          type: Date,
          required: true,
        },
        sent: {
          type: Boolean,
          default: false,
        },
        jobId: {
          type: String,
          default: null,
        },
      },
    ],
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "SNOOZED", "EXPIRED"],
      default: "PENDING",
    },
    snoozedUntil: {
      type: Date,
      default: null,
    },
    actionTokens: {
      doneToken: {
        type: String,
        required: true,
      },
      snoozeToken: {
        type: String,
        required: true,
      },
    },
  },
  { timestamps: true }
);

export const TaskReminder = mongoose.model("TaskReminder", taskReminderSchema, "task_reminders");
export default TaskReminder;
