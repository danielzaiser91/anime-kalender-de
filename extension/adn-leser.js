/*
  **ADN: was die Schnittstelle je Video über die Sprache sagt** (4.31.0).

  ADN nennt die Sprache selbst: `languages` je Video, `vde` = deutsche Synchro, `vostde` = japanischer Ton
  mit deutschen Untertiteln. Dieselbe Schnittstelle (`gw.api.animationdigitalnetwork.com/video/show/<id>`)
  liest die Pipeline seit dem 11.08.2026 (`pipeline/fetch-adn.ts`). Das Abzeichen „SYNCHRO"/„UNTERTITEL"
  auf der Seite gilt für die ganze Serie und sagt nichts über eine Staffel (Dorohedoro: Abzeichen auf
  beiden Staffelseiten, aber nur Staffel 2 hat `vde`); `__NEXT_DATA__` gehört zur zuerst geladenen Seite.
  Gemeldet wird deshalb nur, was die Schnittstelle je Video sagt.

  Ohne Browser-Zustand, damit `adn.test.cjs` die Funktionen im Sandkasten spielen kann.
*/
;
(() => {
  /** Die Kennung der Serie aus dem Pfad: `/de/video/1375-dorohedoro[/31263-folge-1]`. */
  const showId = (pfad) => Number(/^\/(?:[a-z]{2}\/)?video\/(\d+)-/.exec(pfad)?.[1]) || null

  /** Die Serienadresse ohne Folge, Staffel und Suchteil — so steht sie in unserem Bestand. */
  function showUrl(href) {
    const m = /^(https:\/\/animationdigitalnetwork\.com)\/(?:[a-z]{2}\/)?video\/(\d+-[a-z0-9-]+)/i.exec(href)
    return m ? `${m[1]}/de/video/${m[2]}` : null
  }

  /** Dieselben Kopfzeilen wie die Seite selbst (`x-target-distribution` bestimmt den deutschen Katalog). */
  const KOEPFE = { 'x-target-distribution': 'de', 'Accept-Language': 'de', 'x-source': 'Web', 'x-i18n-platform': '1' }

  const SEITE = 100
  const schlaf = (ms) => new Promise((fertig) => setTimeout(fertig, ms))

  /**
   * Alle Videos einer Serie, seitenweise (100 ist das Maximum je Seite, mehr gibt 400).
   * 404 heißt „in Deutschland nicht im Angebot" und ist eine Antwort; alles andere ohne Antwort ist ein Fehler
   * und wird nie als „keine Videos" gelesen.
   */
  async function ladeVideos(id, { holen = (...a) => fetch(...a), pause = 300 } = {}) {
    const videos = []
    for (let offset = 0; offset < 2000; offset += SEITE) {
      let antwort
      try {
        antwort = await holen(`https://gw.api.animationdigitalnetwork.com/video/show/${id}?limit=${SEITE}&offset=${offset}`, {
          headers: KOEPFE,
        })
      } catch (fehler) {
        return { fehler: String(fehler) }
      }
      if (antwort.status === 404) return { videos, nichtImAngebot: videos.length === 0 }
      /* Eine Seite weiter als die erste mit 404 ist das Ende, kein Fehler: dann gilt, was bis hier kam. */
      if (!antwort.ok) return { fehler: `HTTP ${antwort.status}` }
      const seite = (await antwort.json())?.videos ?? []
      videos.push(...seite)
      if (seite.length < SEITE) break
      await schlaf(pause)
    }
    return { videos, nichtImAngebot: videos.length === 0 }
  }

  /** Ton laut `languages`: `ja` = deutsche Synchro da, `nein` = nur Untertitel, `null` = ADN sagt nichts (34 von 7.332 Videos). */
  function tonDe(sprachen) {
    if (sprachen?.includes('vde')) return 'ja'
    return sprachen?.includes('vostde') ? 'nein' : null
  }

  const ganzzahl = (text) => (/^\d+$/.test(String(text ?? '').trim()) ? Number(text) : null)

  /** Was neben Adresse, Folge und Staffel einen Eintrag eindeutig macht (`null` = eine gewöhnliche Folge). */
  function kennungVon(v, folge, staffel) {
    if (!folge) return v.type === 'EPS' ? 'special' : v.type
    return staffel === null && v.season ? String(v.season).slice(0, 40) : null
  }

  /**
   * Ein Video als Zeile der Meldung — oder `null`, wenn es keine Folge im Sinn des Bestands ist
   * (Trailer, Vorschau, „(NC)" = Fassung ohne Vor- und Abspann).
   *
   * Der Schlüssel der Meldung ist Adresse + Folge + Staffel + Kennung (`folgeVon` im Worker): Filme, OVAs und
   * Specials tragen ihre Art als `kennung`, Staffeln mit Namen („Saga 14 : Wano Kuni") ihren Namen.
   */
  function zeile(v) {
    const roh = `${v.number ?? ''} ${v.shortNumber ?? ''}`
    if (v.type === 'PV' || /trailer|bande-annonce|\(NC\)/i.test(roh)) return null
    const staffel = ganzzahl(v.season)
    const nummerKurz = ganzzahl(v.shortNumber)
    const folge = v.type === 'EPS' && nummerKurz !== null
    const nummer = folge ? nummerKurz : (/\d+/.exec(String(v.number ?? ''))?.[0] ?? 1)
    const kennung = kennungVon(v, folge, staffel)
    return {
      videoId: v.id,
      titel: v.title ?? null,
      name: v.name ?? null,
      nummer: Number(nummer),
      staffel,
      staffelText: v.season ? String(v.season) : null,
      referenz: v.reference ?? null,
      kennung,
      sprachen: (v.languages ?? []).map((s) => (s === 'vde' ? 'de' : s === 'vostde' ? 'ja' : s)),
      untertitel: (v.languages ?? []).includes('vostde') ? ['de'] : [],
      tonDe: tonDe(v.languages),
      erschienen: v.releaseDate ?? null,
      dauerSek: v.duration ?? null,
    }
  }

  /** Alle Zeilen einer Serie, nach Staffel und Nummer — und die Videos, über die ADN nichts zur Sprache sagt. */
  function ordne(videos) {
    const alle = (videos ?? []).map(zeile).filter(Boolean)
    const sortiert = alle.sort((a, b) => (a.staffel ?? 0) - (b.staffel ?? 0) || a.nummer - b.nummer || a.videoId - b.videoId)
    return { zeilen: sortiert.filter((z) => z.tonDe), ohneAngabe: sortiert.filter((z) => !z.tonDe).length }
  }

  /** Die Serie aus dem ersten Video (jedes trägt `show`). */
  const serieAus = (videos) => ({ id: videos?.[0]?.show?.id ?? null, titel: videos?.[0]?.show?.title ?? null })

  /** Der Schlüssel, unter dem der Worker eine gemeldete Folge zurückgibt (`?gemeldet=` liefert `folge` = Videotitel). */
  const schluessel = (z) => z.titel ?? `${z.staffel ?? 1}e${z.nummer}`

  /**
   * Die Meldung zu einer Zeile (Stufe 1: Verfügbarkeit und Sprache getrennt). Die Rohfolge steht in der Meldung
   * (Worker: `MIT_ROHFOLGE_IN_MELDUNG`), `gti` ist die Videokennung.
   */
  function meldung(serie, url, z) {
    return {
      plattform: 'adn',
      url,
      sprachen: z.sprachen,
      vorhanden: 'ja',
      ton_de: z.tonDe,
      art: 'gemessen',
      titel: serie.titel,
      serientitel: serie.titel,
      folge: z.titel,
      folge_nr: z.nummer,
      staffel: z.staffel,
      seiten_kennung: z.kennung,
      rohfolgen: [
        {
          gti: String(z.videoId),
          nummer: z.nummer,
          titel: z.name ?? z.titel,
          erschienen: z.erschienen,
          dauerSek: z.dauerSek,
          sprachen: z.sprachen,
          untertitel: z.untertitel,
          staffelText: z.staffelText,
          staffelNr: z.staffel,
          vorhanden: 'ja',
          ton_de: z.tonDe,
          /* ADN zählt Folgen über Staffeln durch (Dorohedoro S2 beginnt bei 13); `reference` zählt je Staffel. */
          roh: { referenz: z.referenz, art: z.kennung },
        },
      ],
    }
  }

  /** „nicht im Angebot" — nur auf Klick (die Schnittstelle antwortet auch bei einem Gebietsfehler mit 404). */
  const wegMeldung = (serie, url) => ({
    plattform: 'adn',
    url,
    vorhanden: 'nein',
    art: 'gemessen',
    titel: serie.titel,
    serientitel: serie.titel,
    notiz: 'ADN meldet: kein Video verfügbar (von Hand gemeldet)',
  })

  /**
   * Was die Seite selbst zeigt: die Abzeichen im Kopf (vor dem ersten Reiter `show-tab`; dahinter folgen die
   * Abzeichen der Empfehlungen) und den Hinweis „Kein Video verfügbar". Nur zur Anzeige und als Gegenprobe —
   * das Abzeichen gilt für die ganze Serie, gemeldet wird es nie.
   */
  function seitenstand(testids, haupttext) {
    const bis = testids.indexOf('show-tab')
    const kopf = bis < 0 ? testids : testids.slice(0, bis)
    return {
      synchro: kopf.includes('text-SYNCHRO'),
      untertitel: kopf.includes('text-UNTERTITEL'),
      keinVideo: /Kein Video verfügbar/.test(haupttext ?? ''),
    }
  }

  /** Zählt für die Anzeige: Synchro und Untertitel je Staffel. */
  function zaehle(zeilen) {
    const ja = zeilen.filter((z) => z.tonDe === 'ja').length
    return { gesamt: zeilen.length, synchro: ja, nurUntertitel: zeilen.length - ja }
  }

  globalThis.AK_ADN_LESER = {
    showId,
    showUrl,
    ladeVideos,
    ordne,
    serieAus,
    schluessel,
    meldung,
    wegMeldung,
    zaehle,
    tonDe,
    seitenstand,
  }
})()
