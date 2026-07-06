export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ticker } = req.body;
  if (!ticker || typeof ticker !== 'string' || ticker.length > 10) {
    return res.status(400).json({ error: 'Ungültiger Ticker' });
  }

  const cleanTicker = ticker.toUpperCase().replace(/[^A-Z0-9.]/g, '');

  // ── 1. LIVE-KURSDATEN von Yahoo Finance ──
  let liveData = null;
  try {
    const yahooRes = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${cleanTicker}?interval=1d&range=1y`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const yahooJson = await yahooRes.json();
    const meta = yahooJson?.chart?.result?.[0]?.meta;

    if (meta) {
      liveData = {
        kurs: meta.regularMarketPrice,
        w52low: meta.fiftyTwoWeekLow,
        w52high: meta.fiftyTwoWeekHigh,
        marketcap: meta.marketCap,
        volume: meta.regularMarketVolume,
        currency: meta.currency || 'USD',
        exchange: meta.fullExchangeName || meta.exchangeName || 'NASDAQ',
        longName: meta.longName || meta.shortName || cleanTicker,
      };
    }
  } catch (e) {
    console.warn('Yahoo Finance Fehler:', e.message);
  }

  // ── 2. Kursdaten formatieren ──
  function formatNum(n) {
    if (!n) return null;
    if (n >= 1e12) return (n / 1e12).toFixed(2) + ' Bio. USD';
    if (n >= 1e9)  return (n / 1e9).toFixed(1) + ' Mrd. USD';
    if (n >= 1e6)  return (n / 1e6).toFixed(1) + ' Mio. USD';
    return n.toLocaleString('de-DE') + ' USD';
  }

  const liveContext = liveData ? `
WICHTIG - ECHTE LIVE-KURSDATEN (diese Zahlen MUSST du exakt so verwenden, nicht abändern!):
- Aktueller Kurs: ${liveData.kurs} ${liveData.currency}
- 52W-Tief: ${liveData.w52low} ${liveData.currency}  
- 52W-Hoch: ${liveData.w52high} ${liveData.currency}
- Market Cap: ${formatNum(liveData.marketcap)}
- Tagesvolumen: ${liveData.volume ? (liveData.volume / 1e6).toFixed(1) + ' Mio.' : 'n/a'}
- Börse: ${liveData.exchange}
- Firmenname: ${liveData.longName}

Für kursRaw verwende exakt: ${liveData.kurs}
Für w52lowRaw verwende exakt: ${liveData.w52low}
Für w52highRaw verwende exakt: ${liveData.w52high}
` : 'Keine Live-Kursdaten verfügbar — schätze realistisch.';

  const today = new Date().toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

  const prompt = `Du bist Aktienanalyst für "CapitalCrew" (deutsche Investment-Community).
Analysiere Aktie: ${cleanTicker}

${liveContext}

KRITISCH: Gib NUR ein JSON-Objekt zurück. Kein Text davor/danach. Kein Markdown. Keine Zeilenumbrüche in String-Werten.

{"ticker":"${cleanTicker}","companyName":"${liveData?.longName || cleanTicker}","exchange":"${liveData?.exchange || 'NASDAQ'}","sector":"Sektor","hq":"Stadt, Land","stand":"${today}","score":65,"verdict":"Kurzes Urteil","verdictText":"2-3 Saetze Investment-Urteil auf Deutsch.","warning":"Kritische Risiken falls vorhanden sonst leerer String","kurs":"${liveData ? liveData.kurs + ' USD' : '0 USD'}","w52low":"${liveData ? liveData.w52low + ' USD' : '0 USD'}","w52high":"${liveData ? liveData.w52high + ' USD' : '0 USD'}","w52lowRaw":${liveData?.w52low || 0},"w52highRaw":${liveData?.w52high || 0},"kursRaw":${liveData?.kurs || 0},"marketcap":"${liveData ? formatNum(liveData.marketcap) : 'n/a'}","volume":"${liveData && liveData.volume ? (liveData.volume/1e6).toFixed(1)+' Mio.' : 'n/a'}","beta":"schaetzen","analystPT":"schaetzen USD","chips":[{"label":"Gegruendet","value":"Jahr"},{"label":"Sitz","value":"Stadt"},{"label":"Flagship","value":"Produkt"},{"label":"Boerse","value":"${liveData?.exchange || 'NASDAQ'}"},{"label":"Stand","value":"${today}"}],"kpis":{"bewertung":[{"k":"Market Cap","v":"${liveData ? formatNum(liveData.marketcap) : 'n/a'}","color":""},{"k":"EV","v":"schaetzen","color":""},{"k":"KGV","v":"schaetzen","color":""},{"k":"P/S","v":"schaetzen","color":""},{"k":"Analyst-PT","v":"schaetzen USD","color":"pos"}],"pl":[{"k":"Umsatz TTM","v":"schaetzen","color":"pos"},{"k":"YoY","v":"schaetzen","color":"pos"},{"k":"Nettomarge","v":"schaetzen","color":"pos"},{"k":"EPS","v":"schaetzen","color":"pos"},{"k":"EBITDA","v":"schaetzen","color":"pos"}],"bilanz":[{"k":"Cash","v":"schaetzen","color":"pos"},{"k":"Schulden","v":"schaetzen","color":""},{"k":"Net Debt","v":"schaetzen","color":""},{"k":"Curr. Ratio","v":"schaetzen","color":""},{"k":"FCF","v":"schaetzen","color":"pos"}],"kapital":[{"k":"Div. Rendite","v":"schaetzen","color":""},{"k":"Buybacks","v":"schaetzen","color":"pos"},{"k":"Payout","v":"schaetzen","color":""},{"k":"Insider","v":"schaetzen","color":""},{"k":"Inst. Own.","v":"schaetzen","color":""}],"aktie":[{"k":"Shares","v":"schaetzen","color":""},{"k":"Float","v":"schaetzen","color":""},{"k":"Short","v":"schaetzen","color":"pos"},{"k":"Analysten","v":"schaetzen","color":"pos"},{"k":"Dividende","v":"schaetzen","color":""}]},"projekte":[{"name":"Segment 1","standort":"Global","kapazitaet":"—","status":"Wachstum","details":"Beschreibung","kapColor":"pos"},{"name":"Segment 2","standort":"USA","kapazitaet":"—","status":"Stabil","details":"Beschreibung","kapColor":""}],"news":[{"date":"Jul. 2026","text":"Positive Entwicklung: Beschreibung."},{"date":"Jun. 2026","text":"Risiko: Beschreibung."},{"date":"Mai 2026","text":"Event: Beschreibung."},{"date":"Apr. 2026","text":"News: Beschreibung."},{"date":"Mar. 2026","text":"Analyst: Beschreibung."}],"bullCase":"Bull Case 2-3 Saetze.","baseCase":"Base Case 2-3 Saetze.","bearCase":"Bear Case 2-3 Saetze.","chancen":["Chance 1","Chance 2","Chance 3","Chance 4","Chance 5","Chance 6"],"risiken":["Risiko 1","Risiko 2","Risiko 3","Risiko 4","Risiko 5","Risiko 6"],"szenarios":[{"name":"Bull","color":"pos","gew":"25%","annahmen":"Annahmen","fv":"schaetzen USD","begruendung":"Begruendung"},{"name":"Base","color":"gold","gew":"50%","annahmen":"Annahmen","fv":"schaetzen USD","begruendung":"Begruendung"},{"name":"Bear","color":"neg","gew":"25%","annahmen":"Annahmen","fv":"schaetzen USD","begruendung":"Begruendung"}],"fairValueGew":"schaetzen USD","fairValueCalc":"Berechnung","fairValueNote":"Kurs: ${liveData ? liveData.kurs + ' USD' : 'n/a'}","kapEigenkapital":[{"k":"Shares out.","v":"schaetzen","color":""},{"k":"Buybacks","v":"schaetzen","color":"pos"},{"k":"Dividende","v":"schaetzen","color":""},{"k":"Insider","v":"schaetzen","color":""},{"k":"Inst. Own.","v":"schaetzen","color":""}],"kapFremdkapital":[{"k":"Gesamtschulden","v":"schaetzen","color":""},{"k":"Net Debt","v":"schaetzen","color":""},{"k":"D/E Ratio","v":"schaetzen","color":""},{"k":"Int. Coverage","v":"schaetzen","color":"pos"},{"k":"Rating","v":"schaetzen","color":"pos"}],"quellen":"Yahoo Finance (Live-Kursdaten), Bloomberg, SEC-Filings, Analystenschaetzungen"}

Ersetze alle "schaetzen" mit realistischen Werten fuer ${cleanTicker} basierend auf deinem Wissen. Die Kursdaten (kurs, w52low, w52high, marketcap, volume) sind bereits korrekt und duerfen NICHT veraendert werden.`;

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
        system: 'Du bist ein Aktienanalyst. Antworte IMMER nur mit einem einzigen validen JSON-Objekt. Niemals Markdown, niemals Text ausserhalb des JSON. Keine rohen Zeilenumbrueche in String-Werten. Live-Kursdaten die im Prompt angegeben sind MUESSEN exakt uebernommen werden.',
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(502).json({ error: err.error?.message || 'Anthropic API Fehler' });
    }

    const data = await response.json();
    const text = data.content.filter(b => b.type === 'text').map(b => b.text).join('');
    return res.status(200).json({ raw: text, hasLiveData: !!liveData });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
