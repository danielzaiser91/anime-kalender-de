/**
 * Steht wirklich alles in der JSON-Antwort — oder braucht es den Seiten-Quelltext?
 *
 * Läuft in der Konsole einer geöffneten Prime-Video-Serienseite, in Daniels
 * angemeldeter Sitzung. Es ruft **denselben** Abruf ab, den die Seite beim
 * Öffnen selbst auslöst (`getDetailWidgets`), und hält die Antwort gegen die
 * sechs Felder, die `amazon.js` heute aus dem HTML liest.
 *
 * Hintergrund (Daniel, 25.08.2026): „aus den metadaten kannst du sicher alle
 * infos rausziehen, du brauchst kein parsing mehr denke ich." Für drei der
 * sechs Felder stimmt das belegt — `audioTracks` je Folge, `benefitId` und die
 * Kennung stehen in der Antwort. Für die drei anderen (Staffelnummer,
 * Serientitel, Regionssperre) ist es offen, und genau die misst dieses Skript.
 *
 * Aufruf: Konsole öffnen (F12), einfügen, Enter. Das Ergebnis liegt danach
 * auch in der Zwischenablage.
 */
;(async () => {
  const kennung = /\/(?:dp|gp\/video\/detail)\/([A-Z0-9]{10,32})/.exec(location.pathname)?.[1]
  if (!kennung) {
    console.log('%cKeine Titel-Kennung in der Adresse — bitte eine Serienseite öffnen.', 'color:#c00')
    return
  }

  const adresse =
    `/gp/video/api/getDetailWidgets?titleID=${kennung}` +
    `&widgets=${encodeURIComponent('[{"widgetType":"EpisodeList"}]')}`

  const antwort = await fetch(adresse, {
    headers: { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' },
  })
  const roh = await antwort.text()

  let daten = null
  try {
    daten = JSON.parse(roh)
  } catch {
    console.log('%cKeine JSON-Antwort — HTTP ' + antwort.status, 'color:#c00')
    return
  }

  const liste = daten?.widgets?.episodeList
  const html = document.documentElement.innerHTML

  /* Ein Feld gilt als „im JSON", wenn sein Name irgendwo in der Antwort steht. */
  const imJson = (name) => roh.includes(`"${name}"`)

  const ergebnis = {
    adresse: location.pathname,
    kennung,
    status: antwort.status,
    antwortZeichen: roh.length,

    /* --- Die drei belegten Felder, zur Kontrolle --------------------------- */
    episodeCount: liste?.episodeCount ?? null,
    folgenMitTonspur: (liste?.episodes ?? []).filter((e) => Array.isArray(e?.detail?.audioTracks)).length,
    tonspurenJeFolge: Object.fromEntries(
      (liste?.episodes ?? []).map((e) => [e?.detail?.episodeNumber, e?.detail?.audioTracks]),
    ),
    benefitIds: [...new Set([...roh.matchAll(/"benefitId"\s*:\s*"([^"]+)"/g)].map((m) => m[1]))],
    pageTitleId: daten?.widgets?.pageContext?.pageTitleId ?? null,

    /* --- Die drei offenen Felder ----------------------------------------- */
    seasonNumber: {
      imJson: imJson('seasonNumber'),
      wert: /"seasonNumber"\s*:\s*(\d+)/.exec(roh)?.[1] ?? null,
      imHtml: /"seasonNumber\\*"\s*:\s*(\d+)/.exec(html)?.[1] ?? null,
    },
    serientitel: {
      /* Der Folgentitel steht drin — gesucht ist der Titel der **Serie**. */
      folgentitel: liste?.episodes?.[0]?.detail?.title ?? null,
      seriennamenFelder: ['seriesTitle', 'showTitle', 'parentTitle', 'heroTitle'].filter(imJson),
      imHtml: (/<title>([^<]*)<\/title>/.exec(html) || [])[1] ?? null,
    },
    regionssperre: {
      imJson: /nicht mehr verf|not available in your/i.test(roh),
      imHtml: /In deiner Region nicht mehr/i.test(html),
    },

    /*
      Und der Gegentest: Welche Feldnamen kommen im HTML vor, aber nicht in der
      Antwort? Das ist die Liste dessen, was ohne Quelltext verloren ginge.
    */
    nurImHtml: ['seasonNumber', 'seriesTitle', 'pageTitleId', 'episodePages', 'audioTracks', 'episodeNumber']
      .filter((f) => html.includes(`"${f}`) && !imJson(f)),
  }

  const text = JSON.stringify(ergebnis, null, 1)
  console.log(text)
  try {
    await navigator.clipboard.writeText(text)
    console.log('%c→ liegt in der Zwischenablage', 'color:#0a0')
  } catch {
    console.log('Zwischenablage nicht erlaubt — Text oben markieren und kopieren.')
  }
})()
