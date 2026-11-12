/**
 * Was Netflix beim Öffnen eines Titelfensters übers Netz tut — gemessen statt vermutet.
 *
 * Der Durchgang wartet beim Titelfenster auf das DOM (Hintergrund nach ~1 s, Inhalt oder nie). Ob Netflix die Titeldaten
 * über eine eigene Anfrage holt, aus der sich „Titel da / Folgen / Sprachen“ oder „Titel gibt es nicht“ sofort
 * ablesen ließe, ist nicht belegt (kein Mitschnitt). Dieses Skript liefert ihn.
 *
 * Es **liest nur**: Es hängt sich vor `fetch` und `XMLHttpRequest` der Seite, schreibt mit und ändert nichts. Gespeichert
 * werden Adresse, Methode, Status, Größe, Dauer, ein Auszug der Antwort und alle 500 ms der Zustand des Fensters
 * (Adresse, Tab-Titel, Hintergrund, Dialog). **Nie** gespeichert werden Kopfzeilen und Cookies; Tokens, Mailadressen,
 * Profilnamen und lange Zufallsfolgen sind in Adresse und Auszügen durch `***` ersetzt (`maskiere`, `maskiereUrl`).
 *
 * ## Benutzen
 *
 * 1. Netflix-Tab öffnen (angemeldet, Profil gewählt), F12, Reiter „Konsole“
 * 2. Dieses Skript einfügen (Chrome verlangt einmal `allow pasting`), Enter
 * 3. Einen Titel öffnen, der laufen sollte, dann einen, der leer bleibt (siehe Anleitung)
 * 4. `akNetz()` eingeben — die Datei `anime-kalender-netflix-netz-<Zeit>.json` landet in „Downloads“
 */
{
  const EINTRAEGE_MAX = 400
  const AUSZUG_ZEICHEN = 600
  const ANFRAGE_ZEICHEN = 300
  /* Nur Netflix selbst, keine Bilder, Videos, Schriften. */
  const HOST_OK = /(^|\.)netflix\.com$/i
  const ENDUNG_NEIN = /\.(?:jpe?g|png|webp|gif|svg|woff2?|ttf|css|mp4|m4s|ico)(?:$|\?)/i
  /* Titel-nahe Anfragen bekommen einen Auszug der Antwort; alles andere nur Kopfdaten. */
  const TITEL_NAH = /shakti|pathevaluator|graphql|\/api\/|\/nq\/|metadata|preflight|title|video|jbv|browse|ichnaea/i

  const SCHLUESSEL_PARAM = /^(?:authurl|auth|token|jwt|esn|sig|signature|secret|key|profileguid|guid|email|password|cookie|nftoken|s|ssl|sessionid|session)$/i
  const SCHLUESSEL_JSON = /"(authURL|esn|nfvdid|token|jwt|signature|secret|profileGuid|guid|firstName|lastName|profileName|memberName|email|emailAddress|phone|phoneNumber|accountOwnerName|userGuid|netflixId|secureNetflixId)"\s*:\s*"[^"]*"/gi

  /** Ersetzt in einem Text, was privat sein könnte. Reihenfolge: erst benannte Felder, dann Formen. */
  const maskiere = (text) =>
    String(text ?? '')
      .replace(SCHLUESSEL_JSON, '"$1":"***"')
      .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '***@***')
      .replace(/eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]*/g, '***jwt***')
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '***uuid***')
      .replace(/[A-Za-z0-9_%+/=-]{40,}/g, '***lang***')

  /** Adresse ohne private Parameter; Titelkennungen (`/title/81686706`, `jbv=…`) bleiben, denn sie sind der Messwert. */
  const maskiereUrl = (url) => {
    try {
      const u = new URL(url, 'https://www.netflix.com')
      for (const name of [...u.searchParams.keys()]) {
        if (SCHLUESSEL_PARAM.test(name)) u.searchParams.set(name, '***')
      }
      const pfad = u.pathname
        .split('/')
        .map((teil) => (teil.length >= 40 ? '***' : teil))
        .join('/')
      return maskiere(`${u.origin}${pfad}${u.search ? decodeURIComponent(u.search) : ''}`)
    } catch {
      return maskiere(String(url).slice(0, 300))
    }
  }

  const wichtig = (url) => {
    try {
      const u = new URL(url, location.href)
      return HOST_OK.test(u.hostname) && !ENDUNG_NEIN.test(u.pathname)
    } catch {
      return false
    }
  }

  /** Der Auszug einer titel-nahen Antwort: maskierter Anfang, ob sie die Kennung der Seite nennt, oberste JSON-Schlüssel. */
  const auszugVon = (text) => {
    const aus = { auszug: maskiere(text.slice(0, AUSZUG_ZEICHEN)) }
    const id = /\/title\/(\d+)/.exec(location.pathname)?.[1]
    aus.nenntSeitenId = id ? text.includes(id) : null
    try {
      aus.jsonSchluessel = Object.keys(JSON.parse(text) ?? {}).slice(0, 12)
    } catch {
      /* Kein JSON: der Auszug zeigt, was es ist. */
    }
    return aus
  }

  /** `kopf` (Methode, Adresse, Anfragekörper) steht schon; die Antwort kommt dazu. */
  const antwortEintragen = (z, kopf, status, text, ms) => {
    const eintrag = { ...kopf, status, bytes: text?.length ?? null, ms }
    if (TITEL_NAH.test(kopf.url) && typeof text === 'string') Object.assign(eintrag, auszugVon(text))
    if (z.eintraege.length < EINTRAEGE_MAX) z.eintraege.push(eintrag)
  }

  const anfrageKopf = (z, art, methode, url, koerper) => ({
    t: Date.now() - z.start,
    art,
    methode: String(methode ?? 'GET').toUpperCase(),
    url: maskiereUrl(url),
    seite: location.pathname,
    anfrage: typeof koerper === 'string' ? maskiere(koerper.slice(0, ANFRAGE_ZEICHEN)) : undefined,
  })

  const fetchHaengen = (z) => {
    const alt = window.fetch
    window.fetch = function (eingabe, optionen) {
      const url = typeof eingabe === 'string' ? eingabe : eingabe?.url
      if (!wichtig(url)) return alt.apply(this, arguments)
      const kopf = anfrageKopf(z, 'fetch', optionen?.method ?? eingabe?.method, url, optionen?.body)
      const t0 = Date.now()
      return alt.apply(this, arguments).then(
        (antwort) => {
          const eintragen = (text) => antwortEintragen(z, kopf, antwort.status, text, Date.now() - t0)
          antwort.clone().text().then(eintragen, () => eintragen(null))
          return antwort
        },
        (fehler) => {
          antwortEintragen(z, kopf, `Fehler: ${String(fehler?.message ?? fehler).slice(0, 80)}`, null, Date.now() - t0)
          throw fehler
        },
      )
    }
  }

  const xhrHaengen = (z) => {
    const oeffnen = XMLHttpRequest.prototype.open
    const senden = XMLHttpRequest.prototype.send
    XMLHttpRequest.prototype.open = function (methode, url) {
      this.__akNetz = { methode, url }
      return oeffnen.apply(this, arguments)
    }
    XMLHttpRequest.prototype.send = function (koerper) {
      const m = this.__akNetz
      if (m && wichtig(m.url)) {
        const kopf = anfrageKopf(z, 'xhr', m.methode, m.url, koerper)
        const t0 = Date.now()
        this.addEventListener('loadend', () => {
          let text = null
          try {
            text = this.responseType === '' || this.responseType === 'text' ? this.responseText : null
          } catch {
            /* Antwort nicht lesbar: nur Status und Dauer. */
          }
          antwortEintragen(z, kopf, this.status, text, Date.now() - t0)
        })
      }
      return senden.apply(this, arguments)
    }
  }

  /** Zustand des Fensters: Adresse, Tab-Titel, Hintergrund, Dialog, Folgen. */
  const lageLesen = () => ({
    pfad: location.pathname,
    titel: maskiere(document.title),
    hintergrund: Boolean(document.querySelector('[data-uia="previewModal--backDrop"]')),
    dialog: Boolean(document.querySelector('[role="dialog"], [data-uia^="previewModal"]:not([data-uia="previewModal--backDrop"])')),
    folgen: document.querySelectorAll('[data-uia*="episode"]').length,
  })

  /** Alle 500 ms; geschrieben wird nur bei Änderung. */
  const lageTakt = (z) =>
    setInterval(() => {
      const l = lageLesen()
      const s = JSON.stringify(l)
      if (s === z.letzte || z.lagen.length >= EINTRAEGE_MAX) return
      z.lagen.push({ t: Date.now() - z.start, ...l })
      z.letzte = s
    }, 500)

  const speichern = (z) => {
    clearInterval(z.takt)
    const erzeugtAm = new Date().toISOString()
    const daten = { erzeugtAm, dauerMs: Date.now() - z.start, adresse: maskiereUrl(location.href), anfragen: z.eintraege, fensterlage: z.lagen }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(daten, null, 2)], { type: 'application/json' }))
    a.download = `anime-kalender-netflix-netz-${erzeugtAm.replace(/[:.]/g, '-')}.json`
    a.click()
    console.log(`Mitschnitt gespeichert: ${z.eintraege.length} Anfragen, ${z.lagen.length} Fensterzustände.`)
    return { anfragen: z.eintraege.length, fensterlage: z.lagen.length }
  }

  const starten = () => {
    const z = { eintraege: [], lagen: [], start: Date.now(), letzte: '', takt: null }
    fetchHaengen(z)
    xhrHaengen(z)
    z.takt = lageTakt(z)
    window.akNetz = () => speichern(z)
    console.log('Mitschnitt läuft. Titel öffnen, danach akNetz() eingeben.')
  }

  /* In Node (Test) nur die reinen Funktionen herausgeben; im Browser läuft der Rest. */
  if (typeof window === 'undefined') module.exports = { maskiere, maskiereUrl }
  else if (window.akNetz) console.log('Mitschnitt läuft schon — akNetz() speichert.')
  else starten()
}
