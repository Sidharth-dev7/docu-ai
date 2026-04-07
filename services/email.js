// docu-ai/services/email.js
require('dotenv').config();
const nodemailer = require('nodemailer');

const transport = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendDraftEmail({ to, productName, version, confluenceUrl }) {
  await transport.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: `[Docu AI] New draft ready — ${productName} v${version}`,
    html: `
      <p>Hi,</p>
      <p>A new documentation draft has been generated for <strong>${productName} v${version}</strong>.</p>
      <p><a href="${confluenceUrl}">View the Confluence Draft</a></p>
      <p>Changes are highlighted: <span style="background-color:#d4edda">green = added</span>, <span style="background-color:#f8d7da">red = removed</span>.</p>
      <p>— Docu AI</p>
    `,
  });
}

module.exports = { sendDraftEmail };
