// Vercel AI SDK streaming example (pseudo-code)
// Install: npm i openai @vercel/ai

import { OpenAI } from 'openai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const prompt = req.body.prompt || 'Say hello';
  const stream = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  });

  res.setHeader('Content-Type', 'text/event-stream');
  for await (const part of stream) {
    res.write(part.choices[0].delta || '');
  }
  res.end();
}
