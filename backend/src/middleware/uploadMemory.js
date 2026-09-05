import multer from "multer";

// In-Memory storage only: raw file buffers exist strictly in RAM and never hit disk
const storage = multer.memoryStorage();

const allowedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/plain",
];

const fileFilter = (_req, file, cb) => {
  if (
    allowedMimeTypes.includes(file.mimetype) ||
    file.originalname.endsWith(".pdf") ||
    file.originalname.endsWith(".docx") ||
    file.originalname.endsWith(".doc") ||
    file.originalname.endsWith(".png") ||
    file.originalname.endsWith(".jpg") ||
    file.originalname.endsWith(".jpeg")
  ) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Unsupported file type: ${file.mimetype}. Only PDF, DOCX, PNG, and JPG files are supported.`
      ),
      false
    );
  }
};

export const uploadMemory = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25 MB max
  },
  fileFilter,
});

export default uploadMemory;
