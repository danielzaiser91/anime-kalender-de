/*
  Messskript (17.09.2026, PoC gti-Brücke): Welche Kennungen nennt eine Prime-Seite über sich selbst?

  Anlass: JustWatchs Link für „Cowboy Bebop: Der Film" landet auf
  /gp/video/detail/0TECWCCSSY5EN20G3JCF6GTI5X, unser Bestand kennt B0B8TR93HR.
  Die Brücke trägt nur, wenn eine Seite ihre B0-ASIN, ihre 26-stellige Kennung und
  ihre gti (amzn1.dv.gti.…) gemeinsam nennt.

  Aufruf: auf einer Amazon-Titelseite in die Konsole (F12) einfügen, Enter.
  Die Ausgabe landet zusätzlich in der Zwischenablage.
*/
;(() => {
  const html = document.documentElement.outerHTML
  const zaehle = (re) => {
    const m = new Map()
    for (const x of html.matchAll(re)) m.set(x[0], (m.get(x[0]) ?? 0) + 1)
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 8)
  }
  let seite = null
  for (const s of document.querySelectorAll('script[type="application/json"], script:not([src])')) {
    const t = s.textContent
    if (!t || !t.includes('headerDetail')) continue
    try {
      const j = JSON.parse(t)
      const suche = (o, tiefe = 0) => {
        if (!o || typeof o !== 'object' || tiefe > 12) return null
        if (o.pageTitleId && o.detail) return o
        for (const v of Object.values(o)) { const r = suche(v, tiefe + 1); if (r) return r }
        return null
      }
      const oben = suche(j)
      if (!oben) continue
      const kopf = { ...(oben.detail?.detail ?? {}), ...(oben.detail?.headerDetail ?? {}) }
      const eigen = kopf[oben.pageTitleId] ?? {}
      const gtiFelder = {}
      const sammle = (o, pfad, tiefe = 0) => {
        if (!o || typeof o !== 'object' || tiefe > 6) return
        for (const [k, v] of Object.entries(o)) {
          if (typeof v === 'string' && /gti|asin|catalogid|titleid/i.test(k)) gtiFelder[`${pfad}.${k}`] = v
          else if (typeof v === 'object') sammle(v, `${pfad}.${k}`, tiefe + 1)
        }
      }
      sammle(eigen, 'eigenerKopf')
      seite = {
        pageTitleId: oben.pageTitleId,
        kopfSchluessel: Object.keys(kopf),
        titel: eigen.title ?? null,
        entityType: eigen.entityType ?? null,
        kennungsFelderImEigenenKopf: gtiFelder,
      }
      break
    } catch { /* nächster Block */ }
  }
  const bericht = {
    adresse: location.pathname,
    seite,
    b0Asins: zaehle(/\bB0[A-Z0-9]{8}\b/g),
    lange: zaehle(/\b0[A-Z0-9]{25}\b/g),
    gtis: zaehle(/amzn1\.dv\.gti\.[0-9a-f-]{36}/g),
  }
  const text = JSON.stringify(bericht, null, 1)
  console.log(text)
  try { copy(text) } catch { /* nur in DevTools verfügbar */ }
})()
