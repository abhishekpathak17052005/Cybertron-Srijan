import axios from "axios";

// If VITE_API_URL is provided, use it; otherwise use relative path so Vite proxy handles /api
const API_BASE_URL = import.meta.env.VITE_API_URL || "";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 2 minutes for LLM extraction
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Upload and analyze contract document strictly in-memory
 */
export async function analyzeDocument(file: File, recipientEmail?: string, onProgress?: (percent: number) => void) {
  const formData = new FormData();
  formData.append("file", file);
  if (recipientEmail) {
    formData.append("recipientEmail", recipientEmail);
  }

  const response = await apiClient.post("/api/documents/analyze", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total && onProgress) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });

  return response.data;
}

/**
 * Query Grounded Graph Copilot
 */
export async function queryChat(sessionId: string, question: string) {
  const response = await apiClient.post("/api/chat/query", {
    sessionId,
    question,
  });
  return response.data;
}

/**
 * Fetch scheduled tasks for active session or all tasks
 */
export async function getTasks(sessionId?: string) {
  const response = await apiClient.get("/api/tasks", {
    params: { sessionId },
  });
  return response.data;
}

/**
 * Create a custom task reminder
 */
export async function createTask(taskData: {
  sessionId?: string;
  title: string;
  deadline: string;
  clauseRef?: string;
  recipientEmail?: string;
}) {
  const response = await apiClient.post("/api/tasks", taskData);
  return response.data;
}

/**
 * Toggle task completed/pending status
 */
export async function toggleTask(taskId: string) {
  const response = await apiClient.patch(`/api/tasks/${taskId}/toggle`);
  return response.data;
}

/**
 * Fetch saved document session
 */
export async function getDocumentSession(sessionId: string) {
  const response = await apiClient.get(`/api/documents/${sessionId}`);
  return response.data;
}

/**
 * Verify document authenticity via in-memory 3-layer forensic audit
 */
export async function verifyAuthenticity(file: File, sessionId?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (sessionId) {
    formData.append("sessionId", sessionId);
  }

  const response = await apiClient.post("/api/documents/verify-authenticity", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
}

/**
 * Server health check
 */
export async function checkHealth() {
  const response = await apiClient.get("/api/health");
  return response.data;
}

export default {
  analyzeDocument,
  verifyAuthenticity,
  queryChat,
  getTasks,
  createTask,
  toggleTask,
  getDocumentSession,
  checkHealth,
};
