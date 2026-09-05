import crypto from "crypto";

const DEFAULT_SECRET = "legallens_secure_hmac_secret_key_2026_spec_production_environment";

function getSecret() {
  return process.env.JWT_SECRET || DEFAULT_SECRET;
}

/**
 * Generate an HMAC-SHA256 token for email one-click actions
 * @param {string} taskId
 * @param {'done' | 'snooze'} action
 * @returns {string}
 */
export function generateActionToken(taskId, action) {
  const secret = getSecret();
  const payload = `${taskId}:${action}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verify an HMAC-SHA256 token for email one-click actions
 * @param {string} taskId
 * @param {'done' | 'snooze'} action
 * @param {string} token
 * @returns {boolean}
 */
export function verifyActionToken(taskId, action, token) {
  if (!taskId || !action || !token) return false;

  const expectedToken = generateActionToken(taskId, action);
  try {
    const expectedBuffer = Buffer.from(expectedToken, "hex");
    const providedBuffer = Buffer.from(token, "hex");

    if (expectedBuffer.length !== providedBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  } catch {
    return false;
  }
}

export default { generateActionToken, verifyActionToken };
