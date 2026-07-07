export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { ticker } = req.body;
  if (!ticker || typeof ticker !== 'string' || ticker.length > 10) return res.status(400).json({ error: 'Ungültiger Ticker' });
  const t = ticker.toUpperCase().replace(/[^A-Z0-9.]/g, '');
  const FMP = process.env.FMP_API_KEY;
  const NEWS = process.env.NEWS_API_KEY;

  function fmt(n,d=1){if(!n&&n!==0)return 'n/a';const a=Math.abs(n);if(a>=1e12)return(n/1e12).toFixed(d)+' Bio.';if(a>=1e9)return(n/1e9).toFixed(d)+' Mrd.';if(a>=1e6)return(n/1e6).toFixed(d)+' Mio.';return n.toLocaleString('de-DE');}
  function fmtUSD(n,d=1){return n?fmt(n,d)+' USD':'n/a';}
  function fmtPct(n){return n!=null?(n>0?'+':'')+n.toFixed(1)+'%':'n/a';}
  function safe(p){return p.catch(()=>null);}
  const today=new Date().toLocaleDateString('de-DE',{month:'long',year:'numeric'});

  const [yahooRaw,profileRaw,metricsRaw,incomeRaw,analystRaw,insiderRaw,earningsRaw,dividendRaw,newsRaw,priceHistRaw,secRaw] = await Promise.all([
    safe(fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1y`,{headers:{'User-Agent':'Mozilla/5.0'}}).then(r=>r.json())),
    safe(fetch(`https://financialmodelingprep.com/api/v3/profile/${t}?apikey=${FMP}`).then(r=>r.json())),
    safe(fetch(`https://financialmodelingprep.com/api/v3/key-metrics-ttm/${t}?apikey=${FMP}`).then(r=>r.json())),
    safe(fetch(`https://financialmodelingprep.com/api/v3/income-statement/${t}?limit=2&apikey=${FMP}`).then(r=>r.json())),
    safe(fetch(`https://financialmodelingprep.com/api/v3/analyst-stock-recommendations/${t}?limit=1&apikey=${FMP}`).then(r=>r.json())),
    safe(fetch(`https://financialmodelingprep.com/api/v4/insider-trading?symbol=${t}&limit=5&apikey=${FMP}`).then(r=>r.json())),
    safe(fetch(`https://financialmodelingprep.com/api/v3/historical/earning_calendar/${t}?limit=4&apikey=${FMP}`).then(r=>r.json())),
    safe(fetch(`https://financialmodelingprep.com/api/v3/historical-price-full/stock_dividend/${t}?apikey=${FMP}`).then(r=>r.json())),
    safe(fetch(`https://newsapi.org/v2/everything?q=${t}+stock&language=en&sortBy=publishedAt&pageSize=5&apiKey=${NEWS}`).then(r=>r.json())),
    safe(fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=6mo`,{headers:{'User-Agent':'Mozilla/5.0'}}).then(r=>r.json())),
    // SEC EDGAR — Institutional Ownership (13F filings)
    safe(fetch(`https://data.sec.gov/submissions/CIK${t}.json`,{headers:{'User-Agent':'CapitalCrew research@capitalcrew.de'}}).then(r=>r.json())),
  ]);

  // ── YAHOO KURSDATEN ──
  const meta=yahooRaw?.chart?.result?.[0]?.meta||{};
  const liveKurs=meta.regularMarketPrice||0, w52low=meta.fiftyTwoWeekLow||0, w52high=meta.fiftyTwoWeekHigh||0;
  const mktCap=meta.marketCap||0, vol=meta.regularMarketVolume||0;
  const currency=meta.currency||'USD', exchange=meta.fullExchangeName||'NASDAQ', longName=meta.longName||meta.shortName||t;
  const sharesOut=meta.sharesOutstanding||0;

  // Short Interest aus Yahoo Summary
  let shortPct='n/a';
  try {
    const summaryRes=await fetch(`https://query2.finance.yahoo.com/v10/finance/quoteSummary/${t}?modules=defaultKeyStatistics`,{headers:{'User-Agent':'Mozilla/5.0'}});
    const summaryJson=await summaryRes.json();
    const stats=summaryJson?.quoteSummary?.result?.[0]?.defaultKeyStatistics;
    if(stats?.shortPercentOfFloat?.raw!=null) shortPct=(stats.shortPercentOfFloat.raw*100).toFixed(1)+'%';
  } catch(e){}

  // ── FMP PROFIL ──
  const prof=Array.isArray(profileRaw)?profileRaw[0]:null;
  const sektor=prof?.sector||'n/a', industrie=prof?.industry||'n/a';
  const hq=prof?`${prof.city||''}, ${prof.country||''}`.replace(/^, |, $/,''):'n/a';
  const beta=prof?.beta?.toFixed(2)||'n/a', ceo=prof?.ceo||'n/a';
  const employees=prof?.fullTimeEmployees?prof.fullTimeEmployees.toLocaleString('de-DE'):'n/a';
  const ipoDate=prof?.ipoDate||'n/a', analystPT=prof?.dcf?prof.dcf.toFixed(2)+' USD':'n/a';

  // ── FMP METRICS ──
  const m=Array.isArray(metricsRaw)?metricsRaw[0]:null;
  const pe=m?.peRatioTTM?.toFixed(1)||'n/a', ps=m?.priceToSalesRatioTTM?.toFixed(1)||'n/a';
  const pb=m?.pbRatioTTM?.toFixed(1)||'n/a', ev=m?.enterpriseValueTTM?fmtUSD(m.enterpriseValueTTM):'n/a';
  const fcfPS=m?.freeCashFlowPerShareTTM?.toFixed(2)||'n/a';
  const divYield=m?.dividendYielPercentageTTM?m.dividendYielPercentageTTM.toFixed(2)+'%':'0%';
  const roe=m?.roeTTM?(m.roeTTM*100).toFixed(1)+'%':'n/a';
  const deRatio=m?.debtToEquityTTM?.toFixed(2)||'n/a', currentRatio=m?.currentRatioTTM?.toFixed(2)||'n/a';

  // ── FMP INCOME ──
  const inc0=Array.isArray(incomeRaw)?incomeRaw[0]:null, inc1=Array.isArray(incomeRaw)?incomeRaw[1]:null;
  const revenue=inc0?.revenue?fmtUSD(inc0.revenue):'n/a';
  const netIncome=inc0?.netIncome?fmtUSD(inc0.netIncome):'n/a';
  const ebitda=inc0?.ebitda?fmtUSD(inc0.ebitda):'n/a';
  const eps=inc0?.eps?.toFixed(2)||'n/a';
  const netMargin=inc0&&inc0.revenue?((inc0.netIncome/inc0.revenue)*100).toFixed(1)+'%':'n/a';
  const revenueYoY=inc0&&inc1&&inc1.revenue?fmtPct(((inc0.revenue-inc1.revenue)/Math.abs(inc1.revenue))*100):'n/a';

  // ── ANALYST ──
  const an=Array.isArray(analystRaw)?analystRaw[0]:null;
  const analystBuy=an?.analystRatingsbuy||0, analystHold=an?.analystRatingsHold||0, analystSell=an?.analystRatingsSell||0;
  const analystTotal=analystBuy+analystHold+analystSell;
  const analystStr=analystTotal>0?`${analystBuy}x Buy / ${analystHold}x Hold / ${analystSell}x Sell`:'n/a';

  // ── INSIDER ──
  const insiderList=Array.isArray(insiderRaw)?insiderRaw.slice(0,3):[];
  const insiderStr=insiderList.length>0
    ?insiderList.map(i=>`${i.transactionDate}: ${i.reportingName} ${i.transactionType} ${i.securitiesTransacted?.toLocaleString('de-DE')} Aktien`).join(' | ')
    :'Keine aktuellen Insider-Transaktionen';

  // ── EARNINGS ──
  const earnList=Array.isArray(earningsRaw)?earningsRaw:[];
  const nextE=earnList.find(e=>new Date(e.date)>new Date());
  const lastE=earnList.find(e=>new Date(e.date)<=new Date());
  const earningsStr=nextE?`Naechster: ${nextE.date} | EPS-Est: ${nextE.epsEstimated?.toFixed(2)||'n/a'} USD`
    :lastE?`Letzter: ${lastE.date} | EPS: ${lastE.eps?.toFixed(2)||'n/a'} USD (Est: ${lastE.epsEstimated?.toFixed(2)||'n/a'})`:'n/a';

  // ── DIVIDENDEN ──
  const divHist=dividendRaw?.historical?.slice(0,3)||[];
  const divStr=divHist.length>0?divHist.map(d=>`${d.date}: ${d.dividend?.toFixed(2)} USD`).join(' | '):'Keine Dividende';

  // ── NEWS ──
  const articles=newsRaw?.articles?.slice(0,5)||[];
  const newsItems=articles.length>0
    ?articles.map(a=>`{"date":"${a.publishedAt?.slice(0,10)||'n/a'}","text":"${(a.title||'').replace(/"/g,"'").replace(/\n/g,' ').slice(0,120)}"}`)
    :['{"date":"n/a","text":"Keine aktuellen News verfuegbar."}'];

  // ── TECHNISCHE INDIKATOREN (aus Yahoo 6M Daten) ──
  let rsi='n/a', rsiSignal='Neutral';
  let macd='n/a', macdSignal='n/a', macdHist='n/a', macdTrend='n/a';
  let bbUpper='n/a', bbMiddle='n/a', bbLower='n/a', bbSignal='n/a';

  try {
    const closes=priceHistRaw?.chart?.result?.[0]?.indicators?.quote?.[0]?.close||[];
    const c=closes.filter(Boolean);

    if(c.length>=20) {
      // RSI (14)
      const rsiPeriod=14;
      let gains=0,losses=0;
      for(let i=c.length-rsiPeriod;i<c.length;i++){
        const d=c[i]-c[i-1];
        if(d>0)gains+=d;else losses+=Math.abs(d);
      }
      const avgG=gains/rsiPeriod, avgL=losses/rsiPeriod;
      const rs=avgL===0?100:avgG/avgL;
      const rsiVal=100-(100/(1+rs));
      rsi=rsiVal.toFixed(1);
      rsiSignal=rsiVal>70?'Ueberkauft ⚠':rsiVal<30?'Ueberverkauft 📉':'Neutral ✓';

      // EMA helper
      function ema(data, period) {
        const k=2/(period+1);
        let emaVal=data.slice(0,period).reduce((a,b)=>a+b,0)/period;
        for(let i=period;i<data.length;i++) emaVal=data[i]*k+emaVal*(1-k);
        return emaVal;
      }

      // MACD (12, 26, 9)
      if(c.length>=26) {
        const ema12=ema(c,12), ema26=ema(c,26);
        const macdLine=ema12-ema26;
        // Signal line approx
        const macdVals=[];
        for(let i=26;i<=c.length;i++) {
          const e12=ema(c.slice(0,i),12), e26=ema(c.slice(0,i),26);
          macdVals.push(e12-e26);
        }
        const signalLine=ema(macdVals,9);
        const histogram=macdLine-signalLine;
        macd=macdLine.toFixed(3);
        macdSignal=signalLine.toFixed(3);
        macdHist=histogram.toFixed(3);
        macdTrend=histogram>0?'Bullish ↑':'Bearish ↓';
      }

      // Bollinger Bands (20, 2)
      const bbPeriod=20;
      const recent20=c.slice(-bbPeriod);
      const sma=recent20.reduce((a,b)=>a+b,0)/bbPeriod;
      const variance=recent20.reduce((a,b)=>a+Math.pow(b-sma,2),0)/bbPeriod;
      const stdDev=Math.sqrt(variance);
      const upper=sma+2*stdDev, lower=sma-2*stdDev;
      const lastClose=c[c.length-1];
      bbUpper=upper.toFixed(2); bbMiddle=sma.toFixed(2); bbLower=lower.toFixed(2);
      bbSignal=lastClose>upper?'Oberes Band (Ueberkauft)':lastClose<lower?'Unteres Band (Ueberverkauft)':'Innerhalb Bands (Neutral)';
    }
  } catch(e){}

  // ── SEC INSTITUTIONAL OWNERSHIP ──
  // Versuche direkt über FMP (einfacher)
  let instOwnership='n/a';
  try {
    const instRes=await fetch(`https://financialmodelingprep.com/api/v3/institutional-holder/${t}?apikey=${FMP}`);
    const instJson=await instRes.json();
    if(Array.isArray(instJson)&&instJson.length>0) {
      const top3=instJson.slice(0,3).map(i=>`${i.holder}: ${i.shares?.toLocaleString('de-DE')} Aktien`).join(' | ');
      const totalShares=instJson.reduce((a,b)=>a+(b.shares||0),0);
      const pct=sharesOut>0?((totalShares/sharesOut)*100).toFixed(1)+'%':'n/a';
      instOwnership=`${pct} inst. | Top 3: ${top3}`;
    }
  } catch(e){}

  // ── PROMPT FÜR CLAUDE ──
  const prompt=`Du bist Aktienanalyst fuer CapitalCrew. Erstelle Factsheet fuer ${t}.

ECHTE DATEN (exakt uebernehmen):
Kurs: ${liveKurs} ${currency} | 52W: ${w52low}-${w52high} | MarketCap: ${fmtUSD(mktCap)} | Shares: ${sharesOut?fmt(sharesOut)+' Stk':'n/a'}
Sektor: ${sektor} | Industrie: ${industrie} | HQ: ${hq} | CEO: ${ceo} | Mitarbeiter: ${employees} | IPO: ${ipoDate}
KGV: ${pe}x | P/S: ${ps}x | P/B: ${pb}x | EV: ${ev} | DCF: ${analystPT}
Umsatz: ${revenue} (${revenueYoY}) | Nettomarge: ${netMargin} | EPS: ${eps} | EBITDA: ${ebitda}
ROE: ${roe} | D/E: ${deRatio} | Current Ratio: ${currentRatio} | FCF/Share: ${fcfPS} | Div.Rendite: ${divYield}
Analysten: ${analystStr}
Insider: ${insiderStr}
Earnings: ${earningsStr}
Dividenden: ${divStr}
Inst. Ownership: ${instOwnership}
Short Interest: ${shortPct}
RSI(14): ${rsi} - ${rsiSignal}
MACD: ${macd} | Signal: ${macdSignal} | Hist: ${macdHist} | Trend: ${macdTrend}
Bollinger: Upper ${bbUpper} | Middle ${bbMiddle} | Lower ${bbLower} | Signal: ${bbSignal}

NEWS:
${articles.map((a,i)=>`${i+1}. [${a.publishedAt?.slice(0,10)}] ${a.title}`).join('\n')}

Antworte NUR mit validem JSON. Kein Markdown. Keine Zeilenumbrueche in Strings. Alle schaetzen-Felder mit realistischen Werten.

{"ticker":"${t}","companyName":"${longName}","exchange":"${exchange}","sector":"${sektor}","hq":"${hq}","ceo":"${ceo}","employees":"${employees}","stand":"${today}","score":65,"verdict":"Urteil","verdictText":"3-4 Saetze Deutsch.","warning":"Kritische Risiken oder leerer String","kurs":"${liveKurs} ${currency}","w52low":"${w52low} ${currency}","w52high":"${w52high} ${currency}","w52lowRaw":${w52low},"w52highRaw":${w52high},"kursRaw":${liveKurs},"marketcap":"${fmtUSD(mktCap)}","volume":"${(vol/1e6).toFixed(1)} Mio.","beta":"${beta}","analystPT":"${analystPT}","rsi":"${rsi} - ${rsiSignal}","macd":"MACD ${macd} | ${macdTrend}","bollinger":"BB Upper ${bbUpper} / Mid ${bbMiddle} / Lower ${bbLower} | ${bbSignal}","earnings":"${earningsStr}","shortInterest":"${shortPct}","instOwnership":"${instOwnership.slice(0,80)}","chips":[{"label":"CEO","value":"${ceo}"},{"label":"Sitz","value":"${hq}"},{"label":"Mitarbeiter","value":"${employees}"},{"label":"IPO","value":"${ipoDate}"},{"label":"Stand","value":"${today}"}],"kpis":{"bewertung":[{"k":"Market Cap","v":"${fmtUSD(mktCap)}","color":""},{"k":"EV","v":"${ev}","color":""},{"k":"KGV (TTM)","v":"${pe}x","color":""},{"k":"P/S (TTM)","v":"${ps}x","color":""},{"k":"DCF Fair Value","v":"${analystPT}","color":"pos"}],"pl":[{"k":"Umsatz TTM","v":"${revenue}","color":"pos"},{"k":"Umsatz YoY","v":"${revenueYoY}","color":"pos"},{"k":"Nettomarge","v":"${netMargin}","color":"pos"},{"k":"EPS (TTM)","v":"${eps} USD","color":"pos"},{"k":"EBITDA","v":"${ebitda}","color":"pos"}],"bilanz":[{"k":"Current Ratio","v":"${currentRatio}x","color":""},{"k":"D/E Ratio","v":"${deRatio}x","color":""},{"k":"ROE","v":"${roe}","color":"pos"},{"k":"FCF/Share","v":"${fcfPS} USD","color":"pos"},{"k":"Div. Rendite","v":"${divYield}","color":""}],"kapital":[{"k":"Analysten","v":"${analystStr}","color":"pos"},{"k":"Inst. Own.","v":"schaetzen%","color":""},{"k":"Short Interest","v":"${shortPct}","color":""},{"k":"P/B (TTM)","v":"${pb}x","color":""},{"k":"Shares out.","v":"${sharesOut?fmt(sharesOut)+' Stk':'n/a'}","color":""}],"aktie":[{"k":"RSI (14T)","v":"${rsi} - ${rsiSignal}","color":""},{"k":"MACD","v":"${macdTrend}","color":""},{"k":"Bollinger","v":"${bbSignal}","color":""},{"k":"Beta","v":"${beta}","color":""},{"k":"Earnings","v":"schaetzen","color":""}]},"projekte":[{"name":"schaetzen","standort":"Global","kapazitaet":"schaetzen","status":"schaetzen","details":"schaetzen","kapColor":"pos"},{"name":"schaetzen","standort":"schaetzen","kapazitaet":"schaetzen","status":"schaetzen","details":"schaetzen","kapColor":""}],"news":[${newsItems.join(',')}],"insider":"${insiderStr.replace(/"/g,"'")}","dividenden":"${divStr}","bullCase":"schaetzen","baseCase":"schaetzen","bearCase":"schaetzen","chancen":["schaetzen","schaetzen","schaetzen","schaetzen","schaetzen","schaetzen"],"risiken":["schaetzen","schaetzen","schaetzen","schaetzen","schaetzen","schaetzen"],"szenarios":[{"name":"Bull","color":"pos","gew":"25%","annahmen":"schaetzen","fv":"schaetzen USD","begruendung":"schaetzen"},{"name":"Base","color":"gold","gew":"50%","annahmen":"schaetzen","fv":"schaetzen USD","begruendung":"schaetzen"},{"name":"Bear","color":"neg","gew":"25%","annahmen":"schaetzen","fv":"schaetzen USD","begruendung":"schaetzen"}],"fairValueGew":"schaetzen USD","fairValueCalc":"schaetzen","fairValueNote":"Kurs: ${liveKurs} USD","kapEigenkapital":[{"k":"Shares out.","v":"${sharesOut?fmt(sharesOut)+' Stk':'n/a'}","color":""},{"k":"Buybacks","v":"schaetzen","color":"pos"},{"k":"Dividende","v":"${divYield}","color":""},{"k":"Insider (zuletzt)","v":"schaetzen","color":""},{"k":"Inst. Own.","v":"schaetzen%","color":""}],"kapFremdkapital":[{"k":"Gesamtschulden","v":"schaetzen","color":""},{"k":"Net Debt","v":"schaetzen","color":""},{"k":"D/E Ratio","v":"${deRatio}x","color":""},{"k":"Current Ratio","v":"${currentRatio}x","color":"pos"},{"k":"ROE","v":"${roe}","color":"pos"}],"quellen":"Yahoo Finance (Live-Kurse + Technische Analyse), FMP (Fundamentaldaten + Insider + Earnings), NewsAPI (News)"}`;

  try {
    const response=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
      body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:4000,system:'Du bist Aktienanalyst. Antworte NUR mit validem JSON. Kein Markdown. Keine Zeilenumbrueche in Strings. Echte Datenpunkte exakt uebernehmen. Alle schaetzen-Felder mit realistischen Werten fuer den Ticker fuellen.',messages:[{role:'user',content:prompt}]}),
    });
    if(!response.ok){const e=await response.json().catch(()=>({}));return res.status(502).json({error:e.error?.message||'API Fehler'});}
    const data=await response.json();
    const text=data.content.filter(b=>b.type==='text').map(b=>b.text).join('');
    return res.status(200).json({raw:text,hasLiveData:true});
  } catch(err){
    return res.status(500).json({error:err.message});
  }
}
