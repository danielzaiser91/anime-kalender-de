/**
 * Was die Regex-Durchläufe der Erweiterung über einen Prime-großen Quelltext
 * wirklich kosten — gemessen statt geschätzt.
 *
 *     node tools/amazon-regex-kosten.js
 *
 * ## Wozu
 *
 * `amazon.js` liest den Seitenquelltext (rund 994.000 Zeichen) und schickt je
 * Takt rund zwanzig Muster darüber. Welche davon teuer sind, ist am Code nicht
 * abzulesen: Ein `test()` und ein `matchAll()` sehen gleich harmlos aus, und
 * zwischen ihnen liegen vier Größenordnungen. Dieses Skript baut einen
 * Quelltext in der gemessenen Größenordnung und stoppt jeden Durchlauf einzeln.
 *
 * ## Was am 25.08.2026 dabei herauskam
 *
 * Der Rückfall in `seitenTitel()` — `([^<>"]{3,120}?)\s+[-–—]\s+Staffel \d+` —
 * braucht **82 bis 121 ms je Durchlauf**. Alles andere zusammen bleibt unter
 * 3 ms. Die Ursache ist nicht die Länge des Quelltextes allein, sondern das
 * faule Zählquantiv: An jeder der knapp einer Million Startstellen probiert der
 * Motor die Längen 3, 4, 5 … durch, bis die Zeichenklasse abbricht.
 *
 * Die Tag-Dichte ändert daran wenig (82 ms mit Tags, 116 ms ohne) — die Zahl
 * ist also nicht ein Artefakt der Füllmasse.
 *
 * ## Grenzen
 *
 * Node, nicht Chrome. Für die Muster ist das derselbe Motor (V8) und damit
 * dieselbe Größenordnung. **Nicht** gemessen werden können hier die beiden
 * teuersten Zugriffe der Erweiterung überhaupt: `documentElement.innerHTML`
 * (baut die Zeichenkette aus dem Baum neu auf) und `body.innerText` (erzwingt
 * ein Layout über die ganze Seite). Die brauchen einen echten Browser.
 */

function baueSeite({ mitTags, ziel = 994000 }) {
  const teile = []
  const jsonFueller =
    '{"__typename":"Recommendation","imageSrc":"https://m.media-amazon.com/images/S/pv-target-images/' +
    'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90._SX1080_.jpg",' +
    '"analytics":{"refMarker":"atv_dp_pd_gw_c_0_0","pageType":"Detail"},' +
    '"synopsis":"Lorem ipsum dolor sit amet consetetur sadipscing elitr sed diam nonumy."},'
  const tagFueller =
    '<div class="_2Rzt9x _1kSXPO" data-testid="card"><a href="/gp/video/detail/B0ABCDEFGH">' +
    '<img alt="Serientitel Staffel 1" src="https://m.media-amazon.com/images/S/x._SX300_.jpg">' +
    '</a><span class="_36qUej">Irgendeine Serie</span><p>Lorem ipsum dolor sit amet</p></div>'
  let i = 0
  let laenge = 0
  while (laenge < ziel) {
    // Rund alle 4,5 KB eine titleID-Fundstelle — die Digimon-Seite führt 220.
    if (i % 10 === 0) {
      const wert = i % 30 === 0 ? '' : 'B0' + String(i).padStart(8, 'X').slice(0, 8)
      const s = `"titleID":"${wert}","seasonNumber":${(i % 5) + 1},`
      teile.push(s)
      laenge += s.length
    }
    if (i % 150 === 0) {
      const s = `"audioTracks":["Deutsch","日本語"],"contributors":{"cast":[]},"episodeNumber":${(i / 150) | 0},`
      teile.push(s)
      laenge += s.length
    }
    if (i % 700 === 0) {
      const s = '"benefitId":"' + (i % 1400 === 0 ? 'Prime' : 'aniversede') + '",'
      teile.push(s)
      laenge += s.length
    }
    const f = mitTags && i % 2 === 0 ? tagFueller : jsonFueller
    teile.push(f)
    laenge += f.length
    i++
  }
  teile.push(
    '<span>Digimon Tamers - Staffel 1</span><div>51 Folgen</div>' +
      '"episodeCount":51,"pageTitle":"Digimon Tamers",' +
      '"episodePages":[{"isSelected":true,"token":"ADAAAAIEAGJhbXpuMS5abcdefghijklmnopqrstuvwxyz0123456789"},' +
      '{"isSelected":false,"token":"ADAAAAIEAGJhbXpuMS5zyxwvutsrqponmlkjihgfedcba98765432"}],' +
      '"pagination":{"tokens":["ADxx1","ADxx2"]},',
  )
  return teile.join('')
}

function miss(name, fn, runden = 20) {
  fn() // aufwärmen, damit nicht der erste Durchlauf die Optimierung mitmisst
  const t0 = process.hrtime.bigint()
  for (let r = 0; r < runden; r++) fn()
  const t1 = process.hrtime.bigint()
  console.log(name.padEnd(58), (Number(t1 - t0) / 1e6 / runden).toFixed(3).padStart(9), 'ms')
}

for (const { mitTags, ziel } of [
  { mitTags: true, ziel: 2200000 },
  { mitTags: true, ziel: 994000 },
  { mitTags: false, ziel: 994000 },
]) {
  const html = baueSeite({ mitTags, ziel })
  const sichtbar = 'Digimon Tamers Staffel 1 Folgen 51 Folgen 1 Std. 26 Min. '.repeat(400)
  const zusammen = `${sichtbar} ${html}`
  console.log(
    `\n=== ${mitTags ? 'mit HTML-Tags (realistisch)' : 'reine JSON-Fracht'} — ` +
      `${html.length.toLocaleString('de-DE')} Zeichen, ` +
      `${(html.match(/</g) || []).length.toLocaleString('de-DE')} spitze Klammern, ` +
      `${(html.match(/titleID/g) || []).length} titleID-Fundstellen ===`,
  )

  // --- amazon.js -----------------------------------------------------------
  // Beide Fassungen nebeneinander — die alte bleibt drin, damit der Gewinn
  // nachprüfbar ist statt behauptet.
  miss('seitenTitel() ALT (bis 1.9): faules Zählquantiv', () =>
    /([^<>"]{3,120}?)\s+[-–—]\s+(?:Staffel|Season)\s+\d+/i.exec(html)?.[1],
  )
  miss('seitenTitel() NEU (ab 2.0): Anker, dann 120 Zeichen zurück', () => {
    const anker = /\s+[-–—]\s+(?:Staffel|Season)\s+\d+/i.exec(html)
    if (!anker) return undefined
    const davor = html.slice(Math.max(0, anker.index - 120), anker.index)
    return /([^<>"]{3,120})$/.exec(davor)?.[1]
  })
  miss('seitenTitel(): pageTitle-Rückfall', () =>
    /"pageTitle"\\*"?\s*:\s*\\*"([^"\\]{3,120})/.exec(html)?.[1],
  )
  miss('spuren(): 2 matchAll gespreizt + 2 exec', () => {
    const a = [...html.matchAll(/"audioTracks"\s*:\s*\[([^\]]*)\]/g)]
    const b = [...html.matchAll(/"episodeNumber"\s*:\s*(\d+)/g)]
    const g =
      Number(/>\s*(\d+)\s*Folgen\s*</.exec(html)?.[1]) ||
      Number(/"episodeCount"\s*:\s*(\d+)/.exec(html)?.[1]) ||
      null
    return [a.length, b.length, g]
  })
  miss('zugangsart(): 5 Muster ohne Anker', () => {
    const kauf =
      /Als Kauf-?\s*(oder Leihtitel|titel)\s*verfügbar/i.test(html) ||
      /(Folge|Staffel)\s+\d+\s+kaufen/i.test(html) ||
      /Kaufen\s+(SD|HD|UHD)\b/.test(html)
    const leihe =
      /Als Kauf- oder Leihtitel verfügbar/i.test(html) || /Leihen\s+(SD|HD|UHD)\b/.test(html)
    return [kauf, leihe]
  })
  miss('abos(): matchAll benefitId gespreizt + Set', () => [
    ...new Set([...html.matchAll(/"benefitId"\s*:\s*"([^"]+)"/g)].map((m) => m[1])),
  ])
  miss('asinAusSeite(): ein exec, gecacht', () =>
    /titleID\\*"\s*:\s*\\*"([A-Z0-9]{10,32})/.exec(html),
  )
  miss('staffelAusSeite(): matchAll faul + 900-Zeichen-Fenster', () => {
    for (const m of html.matchAll(/titleID/g)) {
      const fenster = html.slice(m.index, m.index + 900)
      if (!/titleID\\*"\s*:\s*\\*"[A-Z0-9]{10,32}/.test(fenster)) continue
      const n = /"seasonNumber\\*"\s*:\s*(\d+)/.exec(fenster)?.[1]
      if (n) return Number(n)
      break
    }
    return null
  })
  miss('seitenLage(): 4 Muster über sichtbar+Quelltext', () => [
    /keine funktionsf(?:ä|ae)hige Seite|Suchen Sie etwas?/i.test(zusammen),
    /In deiner Region nicht mehr auf Prime Video verf(?:ü|ue)gbar/i.test(zusammen),
    /Dieses Video ist derzeit nicht verf(?:ü|ue)gbar/i.test(zusammen),
    /Bei der Verarbeitung deiner Anfrage ist ein Fehler aufgetreten/i.test(zusammen),
  ])
  miss('regionFolgenAusDom(): includes-Wächter', () =>
    html.includes('In deiner Region nicht mehr'),
  )

  // --- amazon-leser.js -----------------------------------------------------
  miss('leser ausSeite(): [...matchAll(/titleID/g)] gespreizt', () =>
    [...html.matchAll(/titleID/g)].map((m) => m.index).length,
  )
  miss('leser ausSeite(): episodePages 20k-Ausschnitt + replace', () => {
    let n = 0
    for (const m0 of html.matchAll(/episodePages/g)) {
      const block = html.slice(m0.index, m0.index + 20000).replace(/\\+"/g, '"')
      for (const _ of block.matchAll(
        /"isSelected"\s*:\s*(true|false)[\s\S]{0,400}?"token"\s*:\s*"([^"]{20,})"/g,
      ))
        n++
    }
    return n
  })
  miss('leser abschnittsFinger(): indexOf + 2k-Ausschnitt + exec', () => {
    const i = html.indexOf('episodePages')
    if (i < 0) return ''
    const m = /\\?"token\\?"\s*:\s*\\?"([A-Za-z0-9+/=_.-]{20,})/.exec(html.slice(i, i + 2000))
    return m ? m[1].slice(0, 32) : ''
  })
}

// --- Die Listen-Rechnung im Takt --------------------------------------------
//
// `offeneZahl()` läuft je Takt über alle Listenzeilen, und `fertig()` darin
// über alle bisherigen Meldungen. Das ist kein Quelltext, aber es liegt im
// selben Takt.
{
  const erledigt = {}
  for (let i = 0; i < 300; i++) {
    erledigt['B0' + String(i).padStart(8, '0')] = {
      staffeln: { 1: '🇩🇪', 2: '✕' },
      gesamt: 3,
      serie: 'Serie ' + (i % 90),
    }
  }
  const liste = {}
  for (let i = 0; i < 85; i++) liste['B0' + String(i).padStart(8, '0')] = { titel: 'T' + i }

  const serienGefaehrten = (a) => {
    const serie = erledigt[a]?.serie
    if (!serie) return [a]
    return Object.keys(erledigt).filter((k) => erledigt[k]?.serie === serie)
  }
  const staffelnDerSerie = (a) => {
    const z = {}
    for (const k of serienGefaehrten(a)) Object.assign(z, erledigt[k]?.staffeln ?? {})
    return z
  }
  const fertig = (a) =>
    Boolean(erledigt[a]) &&
    Object.keys(staffelnDerSerie(a)).length >= (erledigt[a]?.gesamt ?? 1)

  console.log('')
  miss(
    'offeneZahl(): 85 Listenzeilen × 300 Meldungen',
    () => Object.keys(liste).filter((a) => !fertig(a)).length,
    200,
  )
}
