import nodemailer from "nodemailer";

let transporter = null;

export function getTransporter() {
  if (transporter) return transporter;

  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
    console.log(`✅ [Mailer] Nodemailer configured via SMTP host: ${SMTP_HOST}`);
  } else {
    // Development/Local Fallback: JSON stream transporter that logs email dispatches
    transporter = nodemailer.createTransport({
      streamTransport: true,
      newline: "unix",
      buffer: true,
    });
    console.log(
      "ℹ️  [Mailer] SMTP credentials not set. Using local stream logger (email dispatches will print to console with action links)."
    );
  }

  return transporter;
}

export async function sendEmail({ to, subject, html, text }) {
  const mailClient = getTransporter();
  const fromAddress = process.env.SMTP_USER || "notifications@legallens.ai";

  try {
    const info = await mailClient.sendMail({
      from: `"LegalLens Intelligence" <${fromAddress}>`,
      to,
      subject,
      text: text || html.replace(/<[^>]+>/g, " "),
      html,
    });

    if (info.message) {
      console.log(`📧 [Mailer Output] Dispatched to: ${to} | Subject: ${subject}`);
      // If it's the stream transport, output preview
      const previewStr = info.message.toString();
      const actionUrls = previewStr.match(/https?:\/\/[^\s"']+/g) || [];
      if (actionUrls.length > 0) {
        console.log("🔗 [Action Links Dispatched in Email]:");
        actionUrls.forEach((url) => console.log(`   👉 ${url}`));
      }
    } else {
      console.log(`📧 [Mailer Output] Message sent: ${info.messageId} to ${to}`);
    }

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ [Mailer] Email dispatch error:", error.message);
    return { success: false, error: error.message };
  }
}

export default { getTransporter, sendEmail };
