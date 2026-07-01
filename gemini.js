export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const { messages, systemPrompt } = req.body || {};
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_KEY) {
      res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server.' });
      return;
    }

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt || 'אתה יועץ פיננסי מקצועי דובר עברית.' }] },
          contents: messages || [],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1500 },
        })
      }
    );

    const data = await r.json();
    if (data.error) throw new Error(data.error.message);
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'לא הצלחתי לקבל תשובה.';
    res.status(200).json({ reply });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}
