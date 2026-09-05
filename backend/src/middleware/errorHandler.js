export function errorHandler(err, _req, res, _next) {
  console.error("❌ [API Error]:", err.stack || err.message);

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      success: false,
      error: "File size exceeds the 25 MB in-memory processing limit.",
    });
  }

  const statusCode = err.statusCode || res.statusCode !== 200 ? res.statusCode : 500;

  res.status(statusCode >= 400 ? statusCode : 500).json({
    success: false,
    error: err.message || "An unexpected server error occurred during document processing.",
  });
}

export default errorHandler;
