export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const results = {};

    // ── Bank of Israel ──
    try {
      const boi = await fetch(
        'https://edge.boi.gov.il/FusionEdgeServer/sdmx/v2/data/dataflow/BOI.STATISTICS/EXR/1.0/RER_USD_ILS,RER_EUR_ILS?startperiod=2024-01-01&format=sdmx-json&offset=0&limit=5&lang=he',
        { headers: { 'Accept': 'application/json' } }
      );
      if (boi.ok) {
        const data = await boi.json();
        const series = data?.data?.dataSets?.[0]?.series || {};
        const keys = Object.keys(series);
        if (keys[0]) {
          const obs = Object.values(series[keys[0]].observations || {});
          if (obs.length >= 2) results.usd = { val: obs[obs.length-1][0], prev: obs[obs.length-2][0] };
        }
        if (keys[1]) {
          const obs = Object.values(series[keys[1]].observations || {});
          if (obs.length >= 2) results.eur = { val: obs[obs.length-1][0], prev: obs[obs.length-2][0] };
        }
      }
    } catch(e) {}

    // ── Yahoo Finance ──
    const symbols = [
      { sym: '%5ETA125.TA', key: 'ta125', label: 'ת״א 125', color: '#6FA88A' },
      { sym: '%5EGSPC', key: 'sp500', label: 'S&P 500', color: '#C9A24A' },
      { sym: '%5ENDX', key: 'ndx', label: 'נאסד״ק 100', color: '#5B8FA8' },
      { sym: 'GC%3DF', key: 'gold', label: 'זהב', color: '#FFD700' },
    ];
    for (const s of symbols) {
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${s.sym}?interval=1d&range=2d`, {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
        });
        if (r.ok) {
          const json = await r.json();
          const meta = json?.chart?.result?.[0]?.meta;
          if (meta?.regularMarketPrice) {
            results[s.key] = { val: meta.regularMarketPrice, prev: meta.chartPreviousClose, label: s.label, color: s.color };
          }
        }
      } catch(e) {}
    }

    // ── הלמ"ס מדד דירות ──
    try {
      const cbs = await fetch('https://api.cbs.gov.il/index/data/price?id=180010&format=json&download=false&lang=he&startperiod=2023-01-01');
      if (cbs.ok) {
        const data = await cbs.json();
        const obs = data?.DataSet?.Series?.Obs || [];
        const sorted = [...obs].sort((a,b) => (b.TimePeriod||'').localeCompare(a.TimePeriod||''));
        if (sorted.length >= 2) {
          const curr = parseFloat(sorted[0].ObsValue);
          const prev = parseFloat(sorted[1].ObsValue);
          results.housingIndex = { val: curr, prev, date: sorted[0].TimePeriod, changePct: (((curr-prev)/prev)*100).toFixed(2) };
        }
      }
    } catch(e) {}

    // ── נדל"ן לפי עיר ──
    const cities = ['תל אביב - יפו','ירושלים','חיפה','נתניה','ראשון לציון','פתח תקווה','באר שבע','אשדוד'];
    const cityPrices = {};
    for (const city of cities) {
      try {
        const url = `https://data.gov.il/api/3/action/datastore_search?resource_id=b8f2e9e1-1b5e-48be-9fec-27f6c6b8a71d&filters={"עיר_שם":"${encodeURIComponent(city)}"}&limit=100`;
        const r = await fetch(url);
        if (r.ok) {
          const d = await r.json();
          const ppm = (d?.result?.records||[])
            .map(rec => { const a=parseFloat(rec['שטח דירה']),p=parseFloat(rec['מחיר']); return a>20&&p>200000?p/a:null; })
            .filter(v=>v&&v>2000&&v<120000);
          if (ppm.length>0) cityPrices[city.replace(' - יפו','')] = { avg: Math.round(ppm.reduce((s,v)=>s+v,0)/ppm.length), count: ppm.length };
        }
      } catch(e) {}
    }
    if (Object.keys(cityPrices).length > 0) results.cityPrices = cityPrices;

    results.fetchedAt = new Date().toISOString();
    res.status(200).json(results);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}
