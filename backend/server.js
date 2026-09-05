import dns from "node:dns";
// Resolve SRV records reliably across Windows networks and restricted local/ISP DNS resolvers
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // Ignore in environments where setServers is restricted
}

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { connectDB, isConnected } from "./src/config/db.js";
import { initAgenda, getAgenda } from "./src/config/agenda.js";
import documentRoutes from "./src/routes/documentRoutes.js";
import chatRoutes from "./src/routes/chatRoutes.js";
import taskRoutes from "./src/routes/taskRoutes.js";
import errorHandler from "./src/middleware/errorHandler.js";

const app = express();
const PORT = process.env.PORT || 5000;

// CORS Configuration
const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, email links)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app") ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1")
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev for smooth pair-programming
    },
    credentials: true,
  })
);

// Standard parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health Check
app.get(["/health", "/api/health"], (_req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "LegalLens Intelligence API",
    uptimeSeconds: Math.floor(process.uptime()),
    databaseConnected: isConnected(),
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use("/api/documents", documentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/tasks", taskRoutes);

// Root greeting
app.get("/", (_req, res) => {
  res.send(`
    <html>
      <body style="background: #0b0f17; color: #bef264; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh;">
        <div style="text-align: center;">
          <h1>LegalLens Backend API</h1>
          <p style="color: #8b949e;">Decision-Ready Document Intelligence Engine is running.</p>
          <p><a href="/api/health" style="color: #bef264;">Check /api/health</a></p>
        </div>
      </body>
    </html>
  `);
});

// Global Error Handler
app.use(errorHandler);

// Start server
async function startServer() {
  console.log("🚀 [LegalLens] Starting backend services...");

  // Initialize DB and background scheduler
  await connectDB();
  await initAgenda();

  const server = app.listen(PORT, () => {
    console.log(`✨ [LegalLens] Server running on http://localhost:${PORT}`);
    console.log(`📡 [LegalLens] Health check: http://localhost:${PORT}/api/health`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `❌ [LegalLens] Port ${PORT} is already in use by another process. Kill the process on port ${PORT} or change PORT in .env.`
      );
    } else {
      console.error("❌ [LegalLens] Server error:", err.message);
    }
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal) => {
    console.log(`\n🛑 [LegalLens] Received ${signal}. Shutting down gracefully...`);
    const agenda = getAgenda();
    if (agenda) {
      try {
        await agenda.stop();
        console.log("✅ [Agenda] Scheduler stopped.");
      } catch (e) {
        console.warn(e.message);
      }
    }
    server.close(() => {
      console.log("✅ [HTTP] Server stopped.");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}

startServer().catch((err) => {
  console.error("❌ [LegalLens] Fatal server startup error:", err);
  process.exit(1);
});

export default app;
