import { Router } from "express";
import { handleAction, getTasks, createTask, toggleTask } from "../controllers/taskController.js";

const router = Router();

// HMAC email one-click action handler
router.get("/action", handleAction);

// Task management endpoints for frontend UI
router.get("/", getTasks);
router.post("/", createTask);
router.patch("/:id/toggle", toggleTask);

export default router;
