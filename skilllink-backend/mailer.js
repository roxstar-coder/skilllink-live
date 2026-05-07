const nodemailer = require('nodemailer');

function getTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS.');
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true',
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 10000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 10000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 15000),
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

function sendMail(to, subject, html) {
  const transporter = getTransporter();

  return transporter.sendMail({
    from: process.env.SMTP_FROM || `"SkillLink Team" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html
  });
}

module.exports = sendMail;
