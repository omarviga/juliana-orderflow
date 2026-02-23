// Example: Generate structured recipes using the Vercel AI or OpenAI SDK
// This returns JSON structured output (ingredients, steps, time)
import { OpenAI } from 'openai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const input = req.body.input || 'Ensalada de pollo';
  const prompt = `Genera una receta en JSON con las llaves: title, servings, time_minutes, ingredients (array), steps (array) para: ${input}`;

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 400,
  });

  // parse content as JSON (best-effort)
  try {
    const text = completion.choices[0].message?.content || '{}';
    const json = JSON.parse(text);
    res.json(json);
  } catch (err) {
    res.status(500).json({ error: 'invalid JSON from model', raw: completion.choices[0].message?.content });
  }
}
