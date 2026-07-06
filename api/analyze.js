export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Basic rate limiting via simple IP check (Vercel adds this header)
  // For heavier protection, add KV-store based rate limiting later

  const { ticker } = req.body;

  if (!ticker || typeof ticker !== 'string' || ticker.length > 10) {
    return res.status(400).json({ error: 'Ungültiger Ticker' });
  }

  const cleanTicker = ticker.toUpperCase().replace(/[^A-Z0-9.]/g, '');

  const today = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const prompt = `Du bist Aktienanalyst für "CapitalCrew" (deutsche Investment-Community).
Analysiere Aktie: ${cleanTicker}

KRITISCH: Gib NUR ein JSON-Objekt zurück. Kein Text davor/danach. Kein Markdown. Keine Zeilenumbrüche innerhalb von String-Werten. Alle Strings sauber escaped.

{"ticker":"${cleanTicker}","companyName":"VOLLSTAENDIGER NAME","exchange":"NASDAQ","sector":"Sektor","hq":"Stadt, Land","stand":"${today}","score":65,"verdict":"Kurzes Urteil","verdictText":"2-3 Saetze Investment-Urteil auf Deutsch.","warning":"Kritische Risiken falls vorhanden, sonst leerer String","kurs":"123.45 USD","w52low":"80.00 USD","w52high":"180.00 USD","w52lowRaw":80,"w52highRaw":180,"kursRaw":123.45,"marketcap":"3.2 Bio. USD","volume":"45 Mio.","beta":"1.2","analystPT":"160 USD","chips":[{"label":"Gegruendet","value":"1990"},{"label":"Sitz","value":"Stadt"},{"label":"Flagship","value":"Produkt"},{"label":"Boerse","value":"NASDAQ"},{"label":"Stand","value":"${today}"}],"kpis":{"bewertung":[{"k":"Market Cap","v":"3.2 Bio.","color":""},{"k":"EV","v":"3.4 Bio.","color":""},{"k":"KGV","v":"32x","color":""},{"k":"P/S","v":"8x","color":""},{"k":"Analyst-PT","v":"160 USD","color":"pos"}],"pl":[{"k":"Umsatz TTM","v":"390 Mrd.","color":"pos"},{"k":"YoY","v":"+5%","color":"pos"},{"k":"Nettomarge","v":"25%","color":"pos"},{"k":"EPS","v":"6.42 USD","color":"pos"},{"k":"EBITDA","v":"130 Mrd.","color":"pos"}],"bilanz":[{"k":"Cash","v":"65 Mrd.","color":"pos"},{"k":"Schulden","v":"110 Mrd.","color":""},{"k":"Net Debt","v":"45 Mrd.","color":""},{"k":"Curr. Ratio","v":"1.0x","color":""},{"k":"FCF","v":"110 Mrd.","color":"pos"}],"kapital":[{"k":"Div. Rendite","v":"0.5%","color":""},{"k":"Buybacks","v":"85 Mrd.","color":"pos"},{"k":"Payout","v":"15%","color":""},{"k":"Insider","v":"0.03%","color":""},{"k":"Inst. Own.","v":"60%","color":""}],"aktie":[{"k":"Shares","v":"15.5 Mrd.","color":""},{"k":"Float","v":"15.4 Mrd.","color":""},{"k":"Short","v":"0.8%","color":"pos"},{"k":"Analysten","v":"35 (25 Buy)","color":"pos"},{"k":"Dividende","v":"0.96 USD","color":""}]},"projekte":[{"name":"Segment 1","standort":"Global","kapazitaet":"—","status":"Wachstum","details":"Kurze Beschreibung","kapColor":"pos"},{"name":"Segment 2","standort":"USA","kapazitaet":"—","status":"Stabil","details":"Kurze Beschreibung","kapColor":""}],"news":[{"date":"Jul. 2026","text":"Positive Entwicklung: Kurze Beschreibung."},{"date":"Jun. 2026","text":"Risiko: Kurze Beschreibung."},{"date":"Mai 2026","text":"Event: Kurze Beschreibung."},{"date":"Apr. 2026","text":"News: Kurze Beschreibung."},{"date":"Mar. 2026","text":"Analyst: Kurze Beschreibung."}],"bullCase":"Bull Case 2-3 Saetze.","baseCase":"Base Case 2-3 Saetze.","bearCase":"Bear Case 2-3 Saetze.","chancen":["Chance 1","Chance 2","Chance 3","Chance 4","Chance 5","Chance 6"],"risiken":["Risiko 1","Risiko 2","Risiko 3","Risiko 4","Risiko 5","Risiko 6"],"szenarios":[{"name":"Bull","color":"pos","gew":"25%","annahmen":"Annahmen","fv":"180 USD","begruendung":"Begruendung"},{"name":"Base","color":"gold","gew":"50%","annahmen":"Annahmen","fv":"140 USD","begruendung":"Begruendung"},{"name":"Bear","color":"neg","gew":"25%","annahmen":"Annahmen","fv":"90 USD","begruendung":"Begruendung"}],"fairValueGew":"137.50 USD","fairValueCalc":"(25% x 180) + (50% x 140) + (25% x 90)","fairValueNote":"Kurs: 123.45 USD","kapEigenkapital":[{"k":"Shares out.","v":"15.5 Mrd.","color":""},{"k":"Buybacks","v":"85 Mrd.","color":"pos"},{"k":"Dividende","v":"0.96 USD","color":""},{"k":"Insider","v":"0.03%","color":""},{"k":"Inst. Own.","v":"60%","color":""}],"kapFremdkapital":[{"k":"Gesamtschulden","v":"110 Mrd.","color":""},{"k":"Net Debt","v":"45 Mrd.","color":""},{"k":"D/E Ratio","v":"1.8x","color":""},{"k":"Int. Coverage","v":"28x","color":"pos"},{"k":"Rating","v":"Aaa/AAA","color":"pos"}],"quellen":"Yahoo Finance, Bloomberg, SEC-Filings"}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4000,
        system: 'Du bist ein Aktienanalyst. Antworte IMMER nur mit einem einzigen validen JSON-Objekt. Niemals Markdown, niemals Text außerhalb des JSON. Keine rohen Zeilenumbrüche in String-Werten.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(502).json({ error: err.error?.message || 'Anthropic API Fehler' });
    }

    const data = await response.json();
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');

    // Return raw text — frontend does the parsing
    return res.status(200).json({ raw: text });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
