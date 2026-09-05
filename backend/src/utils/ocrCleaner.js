import pdfParse from "pdf-parse";
import mammoth from "mammoth";

/**
 * Extract clean textual representation from in-memory file buffers without touching disk
 * @param {Buffer} buffer - RAM file buffer
 * @param {string} mimetype - MIME type of file
 * @param {string} originalname - Original file name
 * @returns {Promise<{ text: string, pageCount: number, isImage: boolean }>}
 */
export async function extractDocumentContent(buffer, mimetype, originalname = "") {
  const ext = originalname.toLowerCase().split(".").pop();

  // 1. PDF Processing
  if (mimetype === "application/pdf" || ext === "pdf") {
    try {
      const data = await pdfParse(buffer);
      const text = data.text ? data.text.trim() : "";
      const pageCount = data.numpages || 1;
      return {
        text,
        pageCount,
        isImage: false,
      };
    } catch (err) {
      console.warn("⚠️ [OCR] pdf-parse error, falling back to binary scan:", err.message);
      return {
        text: buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r]/g, " "),
        pageCount: 1,
        isImage: false,
      };
    }
  }

  // 2. DOCX Processing
  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value ? result.value.trim() : "";
      // Estimate 500 words per page
      const words = text.split(/\s+/).length;
      const pageCount = Math.max(1, Math.ceil(words / 450));
      return {
        text,
        pageCount,
        isImage: false,
      };
    } catch (err) {
      console.warn("⚠️ [OCR] mammoth docx extraction error:", err.message);
    }
  }

  // 3. Image Processing (PNG, JPEG, WebP)
  if (mimetype.startsWith("image/") || ["png", "jpg", "jpeg", "webp"].includes(ext)) {
    return {
      text: "",
      pageCount: 1,
      isImage: true,
      imageBuffer: buffer,
      mimeType: mimetype || `image/${ext === "jpg" ? "jpeg" : ext}`,
    };
  }

  // 4. Plain text fallback
  const text = buffer.toString("utf-8").trim();
  return {
    text,
    pageCount: Math.max(1, Math.ceil(text.length / 2500)),
    isImage: false,
  };
}

export default { extractDocumentContent };
