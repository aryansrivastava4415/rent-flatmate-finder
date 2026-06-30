const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null; // not configured -> caller falls back to console logging
  }
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
}

async function sendEmail({ to, subject, text }) {
  const t = getTransporter();
  if (!t) {
    console.log(`[email.service] (DEV MODE - no SMTP configured) To: ${to} | Subject: ${subject}\n${text}`);
    return { delivered: false, mode: 'console' };
  }
  try {
    await t.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
    return { delivered: true, mode: 'smtp' };
  } catch (err) {
    console.error('[email.service] Failed to send email, logging instead:', err.message);
    console.log(`To: ${to} | Subject: ${subject}\n${text}`);
    return { delivered: false, mode: 'error-fallback' };
  }
}

module.exports = { sendEmail };
