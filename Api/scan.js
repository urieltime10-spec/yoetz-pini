export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const { fileData, fileType, fileName } = req.body || {};
    if (!fileData) { res.status(400).json({ error: 'חסר נתוני קובץ' }); return; }

    const prompt = `זהו מסמך פיננסי (${fileName}). חלץ נתונים והחזר JSON בלבד עם: name, age, phone, city, income, expense, debts (מערך {name,balance,monthlyPayment,interestRate}), savings (מערך {type,amount}), assets (מערך {name,type,value}). JSON בלבד.`;

    const isPDF = fileType === 'application/pdf';
    const isImg = fileType?.startsWith('image/');
    let content;

    if (isPDF || isImg) {
      content = [
        { type: isPDF?'document':'image', source: { type:'base64', media_type:fileType, data:fileData } },
        { type:'text', text:prompt }
      ];
    } else {
      const text = Buffer.from(fileData,'base64').toString('utf-8');
      content = `${prompt}\n\n${text.slice(0,6000)}`;
    }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers: { 'Content-Type':'application/json', 'x-api-key':process.env.ANTHROPIC_API_KEY, 'anthropic-version':'2023-06-01' },
      body: JSON.stringify({ model:'claude-sonnet-4-6', max_tokens:1000, messages:[{role:'user',content}] })
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error.message);
    const raw = (data.content||[]).map(b=>b.text||'').join('').trim();
    res.status(200).json(JSON.parse(raw.replace(/```json|```/g,'').trim()));
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}
