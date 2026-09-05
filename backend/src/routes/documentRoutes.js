import { Router } from "express";
import uploadMemory from "../middleware/uploadMemory.js";
import { analyzeDocument, getDocumentSession } from "../controllers/analyzeController.js";
import { verifyAuthenticity } from "../controllers/authenticityController.js";

const router = Router();

// Ingest, extract intelligence, store vectors, schedule tasks
router.post("/analyze", uploadMemory.single("file"), analyzeDocument);

// Dedicated document authenticity and forensic verification
router.post("/verify-authenticity", uploadMemory.single("file"), verifyAuthenticity);

// Fetch session data
router.get("/:sessionId", getDocumentSession);

export default router;
