// Resend API email example (Node)
// Install: npm i node-fetch

import fetch from 'node-fetch';

export async function sendEmail(to, subject, html) {
  const apiKey = process.env.RESEND_API_KEY;
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'no-reply@yourdomain.com',
      to: [to],
      subject,
      html,
    }),
  });
  return resp.json();
}
