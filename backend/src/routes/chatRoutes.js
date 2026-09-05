import { Router } from "express";
import { queryChat } from "../controllers/chatController.js";

const router = Router();

// Grounded Graph-Augmented RAG Query
router.post("/query", queryChat);

export default router;
