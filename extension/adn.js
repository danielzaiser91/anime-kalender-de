/**
 * ADN: Sprache je Video lesen und auf Klick melden (4.31.0).
 *
 * Der Weg steht in `adn-leser.js`: die Schnittstelle der Seite nennt `languages` je Video (`vde` = Synchro,
 * `vostde` = Untertitel). Dieser Teil zeigt den Kasten, fragt die Ferne nach schon Gemeldetem und sendet
 * den Rest in Stapeln. Wie bei Disney+ und Netflix: gemeldet wird auf Klick, „nicht im Angebot" nie von selbst.
 */
;
(() => {
  const L = globalThis.AK_ADN_LESER
  const NETZ = globalThis.AK_DISNEY_NETZ
  const SENDEN = globalThis.AK_ADN_SENDEN
  const WORKER = 'https://newsletter.animekalender.workers.dev/pruefung'
  /* Der Worker nimmt höchstens zehn Meldungen je Stapel (`PRUEFUNG_STAPEL_HOECHSTENS`). */
  const STAPEL = 10

  const S = {
    seite: null,
    url: null,
    serie: null,
    zeilen: [],
    ohneAngabe: 0,
    gemeldet: new Set(),
    abgelehnt: new Map(),
    neuGemeldet: 0,
    nichtImAngebot: false,
    stand: null,
    fehler: null,
    knopf: null,
    pruefliste: null,
  }

  const kasten = () => akBox('ak-adn-kasten', S.seite ?? location.pathname)

  function debugZeile(box) {
    akDebugLeiste(box, [akBerichtSchalter(() => document.dispatchEvent(new CustomEvent('ak-report')))])
  }

  /** Die Prüfliste steht auf jedem Anbieter im Kasten; ADN führt keine, also leer mit Hinweis (Daniel, 16.10.2026). */
  function prueflisteZeigen(box) {
    if (S.pruefliste?.isConnected) return
    S.pruefliste = document.createElement('button')
    S.pruefliste.type = 'button'
    S.pruefliste.disabled = true
    S.pruefliste.className = 'ak-uebersicht ak-uebersicht-innen'
    S.pruefliste.textContent = 'Prüfliste: leer, ADN meldet je Video'
    box.querySelector('.ak-such-fuss-mitte')?.appendChild(S.pruefliste)
  }

  function zeige(text, { klasse = null, klick = null } = {}) {
    const box = kasten()
    if (!S.knopf?.isConnected) {
      S.knopf = document.createElement('button')
      S.knopf.type = 'button'
      box.querySelector('.ak-z-melden')?.appendChild(S.knopf)
    }
    debugZeile(box)
    prueflisteZeigen(box)
    S.knopf.textContent = text
    S.knopf.className = 'ak-melder' + (klasse === 'gut' ? ' ak-erfolg' : klasse === 'schlecht' ? ' ak-fehler' : '')
    S.knopf.disabled = !klick
    S.knopf.onclick = klick
  }

  /** Die Staffelzeilen der Anzeige: „Staffel 2: 11 Folgen, 11× deutsch" bzw. „nur Untertitel". */
  function staffelZeilen(zeilen) {
    const je = new Map()
    for (const z of zeilen) {
      const name = z.kennung ?? `Staffel ${z.staffel ?? 1}`
      je.set(name, [...(je.get(name) ?? []), z])
    }
    return [...je].map(([name, liste]) => {
      const z = L.zaehle(liste)
      return `${name}: ${z.gesamt} ${z.gesamt === 1 ? 'Video' : 'Videos'}, ${z.synchro ? `${z.synchro}× deutsch` : 'nur Untertitel'}`
    })
  }

  /** Schon in der Ferne: der Videotitel ist der Schlüssel (`?gemeldet=` liefert ihn als `folge`). */
  async function gemeldeteHolen(url) {
    try {
      const antwort = await fetch(`${WORKER}?gemeldet=${encodeURIComponent(url)}`, { cache: 'no-store' })
      if (!antwort.ok) return new Set()
      const daten = await antwort.json()
      return new Set((daten.paare ?? []).map((p) => p.folge).filter(Boolean))
    } catch {
      /* Ohne Auskunft lieber einmal zu viel melden (der Worker schreibt Unverändertes nicht noch einmal). */
      return new Set()
    }
  }

  const offene = () => S.zeilen.filter((z) => !S.gemeldet.has(L.schluessel(z)))

  function zeigeStand() {
    const kopf = S.serie?.titel ?? ''
    if (S.fehler) {
      return zeige(`${kopf}\nADN nicht lesbar (${S.fehler}) — Klick versucht es erneut`, { klasse: 'schlecht', klick: lesen })
    }
    if (S.nichtImAngebot) return zeigeKeinVideo()
    if (!S.zeilen.length) return zeige(`${kopf}\nkeine Sprachangabe von ADN (${S.ohneAngabe} Videos)`)
    const zeilen = staffelZeilen(S.zeilen).join('\n')
    const offen = offene()
    if (!offen.length) return zeige(`${kopf}\n${zeilen}\n✓ ${S.zeilen.length} ${S.neuGemeldet ? '' : 'schon '}gemeldet`, { klasse: 'gut' })
    const abgelehnt = SENDEN.abgelehntText(S, L.schluessel, offen)
    if (abgelehnt) return zeige(`${kopf}\n${zeilen}\n${abgelehnt}`, { klasse: 'schlecht', klick: melden })
    const deutsch = offen.filter((z) => z.tonDe === 'ja').length
    zeige(`${kopf}\n${zeilen}\n▸ ${offen.length} melden (${deutsch}× deutsch)`, { klasse: deutsch ? 'gut' : null, klick: melden })
  }

  /**
   * Keine Videos: ADN zeigt „Kein Video verfügbar". Gemeldet wird das nur auf Klick — die Schnittstelle
   * antwortet auch bei einem Gebietsfehler leer, und ein falsches „weg" hielt schon Rooster Fighter zu Unrecht draußen.
   */
  function zeigeKeinVideo() {
    const seite = S.stand?.keinVideo ? 'Seite zeigt „Kein Video verfügbar"' : 'Seite zeigt Videos nicht'
    zeige(`${S.serie?.titel ?? document.title}\nADN liefert keine Videos (${seite})\n▸ nicht im Angebot melden`, {
      klick: wegMelden,
    })
  }

  const senden = (token, body) => SENDEN.sendeMitKoerper({ sende: NETZ.sende, holen: (...a) => fetch(...a), url: WORKER, token, body })

  async function melden() {
    const { token } = await chrome.storage.sync.get('token')
    if (!token) return zeige('Kein Token — Rechtsklick aufs Symbol, dann Optionen', { klasse: 'schlecht' })
    const offen = offene()
    let fehler = null
    for (let i = 0; i < offen.length && !fehler; i += STAPEL) {
      const teil = offen.slice(i, i + STAPEL)
      zeige(`${S.serie.titel}\nmelde ${Math.min(i + STAPEL, offen.length)}/${offen.length} …`)
      const antwort = await senden(token, { stapel: teil.map((z) => L.meldung(S.serie, S.url, z)) })
      if (antwort.ok) SENDEN.ergebnisseEintragen(S, L.schluessel, teil, antwort.daten?.ergebnisse)
      else fehler = antwort.fehler
    }
    if (fehler) zeige(`${S.serie.titel}\n${fehler} — Klick sendet den Rest erneut`, { klasse: 'schlecht', klick: melden })
    else zeigeStand()
  }

  async function wegMelden() {
    const { token } = await chrome.storage.sync.get('token')
    if (!token) return zeige('Kein Token — Rechtsklick aufs Symbol, dann Optionen', { klasse: 'schlecht' })
    const antwort = await senden(token, L.wegMeldung(S.serie, S.url))
    const grund = antwort.daten?.error ? ` (${antwort.daten.error})` : ''
    zeige(`${S.serie.titel}\n${antwort.ok ? '✓ „nicht im Angebot" gemeldet' : `${antwort.fehler}${grund} — Klick sendet erneut`}`, {
      klasse: antwort.ok ? 'gut' : 'schlecht',
      klick: antwort.ok ? null : wegMelden,
    })
  }

  function seitenstandLesen() {
    const testids = [...document.querySelectorAll('main [data-testid]')].map((e) => e.getAttribute('data-testid'))
    return L.seitenstand(testids, document.querySelector('main')?.textContent ?? '')
  }

  /** Die Videos der Serie laden und anzeigen. Der Titel der Serie kommt aus dem ersten Video, sonst aus der Überschrift. */
  async function lesen() {
    const seite = S.seite
    const id = L.showId(location.pathname)
    zeige('lese ADN …')
    const antwort = await L.ladeVideos(id)
    if (seite !== S.seite) return
    S.fehler = antwort.fehler ?? null
    S.nichtImAngebot = Boolean(antwort.nichtImAngebot)
    S.stand = seitenstandLesen()
    S.serie = { ...L.serieAus(antwort.videos), titel: L.serieAus(antwort.videos).titel ?? document.querySelector('h1')?.textContent?.trim() ?? null }
    const geordnet = L.ordne(antwort.videos)
    S.zeilen = geordnet.zeilen
    S.ohneAngabe = geordnet.ohneAngabe
    S.gemeldet = S.zeilen.length ? await gemeldeteHolen(S.url) : new Set()
    if (seite === S.seite) zeigeStand()
  }

  /* Ein Absturz beim Lesen steht im Kasten, nicht in der Konsole. */
  function lesefehler(fehler) {
    S.fehler = String(fehler?.message ?? fehler)
    zeigeStand()
  }

  function bericht() {
    return {
      erzeugtAm: new Date().toISOString(),
      version: chrome.runtime?.getManifest?.()?.version ?? null,
      adresse: location.href,
      url: S.url,
      serie: S.serie,
      fehler: S.fehler,
      nichtImAngebot: S.nichtImAngebot,
      seitenstand: S.stand,
      ohneAngabe: S.ohneAngabe,
      zeilen: S.zeilen.slice(0, 60).map(({ videoId, titel, staffel, nummer, kennung, tonDe }) => ({ videoId, titel, staffel, nummer, kennung, tonDe })),
      gemeldet: [...S.gemeldet].slice(0, 80),
    }
  }

  /* ADN wechselt die Seite ohne Neuladen: der Kasten gehört zur Serie der Adresse. */
  function pruefeAdresse() {
    const id = L.showId(location.pathname)
    const jetzt = id ? String(id) : null
    if (jetzt === S.seite) return
    S.seite = jetzt
    S.url = L.showUrl(location.href)
    S.serie = null
    S.zeilen = []
    S.gemeldet = new Set()
    S.abgelehnt = new Map()
    S.neuGemeldet = 0
    S.fehler = null
    S.nichtImAngebot = false
    S.knopf?.remove()
    S.knopf = null
    document.querySelector('.ak-adn-kasten')?.remove()
    if (jetzt) lesen().catch(lesefehler)
  }

  document.addEventListener('ak-report', () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(bericht(), null, 2)], { type: 'application/json' }))
    a.download = `anime-kalender-adn-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
  })

  globalThis.AK_ADN = { bericht, zustand: S }
  pruefeAdresse()
  setInterval(pruefeAdresse, 1000)
})()
