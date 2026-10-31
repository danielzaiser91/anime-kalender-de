/**
 * **„▶ alle durchgehen" geht auch durch Suchaufträge und Staffel-Auswahlen (31.10.2026, Weg B).**
 *
 * Eigene Datei, weil `amazon.js` über der Zeilengrenze liegt (check:umfang). Lädt laut Manifest vor
 * `amazon.js`. Alles hier ist reine Rechnung auf dem Lauf-Objekt; Frames, Speicher und Meldeweg bleiben
 * in `amazon.js`.
 *
 * - **Staffel-Auswahl:** Prime führt manche Reihen (Miraculous) mit allen Staffeln unter **einer** ASIN;
 *   das Dropdown unterscheidet sie nur über `?ref_=…_sN` im `seasonLink`. Der Plan hielt bisher nur
 *   Kennungen und verwarf jede zweite Staffel derselben ASIN. Ein Planeintrag ist jetzt die Kennung
 *   (erste Staffel dieser ASIN) oder `<Kennung><Query des seasonLink>` (jede weitere); beides hängt an
 *   `…/gp/video/detail/` und ergibt eine gültige Frame-Adresse.
 * - **Suchaufträge:** Sind die Titel der Liste durch, öffnet der Lauf die Suchseite als Frame; der Frame
 *   liest die Treffer (`akPrimeSucheUrteil`) und der Lauf besucht jeden Treffer wie einen Titel mit seinen
 *   Staffeln, jeweils einen Frame zugleich (der Auftrag steht im Tab-Speicher, nur eine Zielseite zugleich).
 *   Welcher Treffer zum Titel gehört, entscheidet weiter `beurteileTreffer` bzw. der Worker.
 */
{
  const text = (v) => String(v ?? '')

  /** Die Query hinter der Kennung im `seasonLink` („?ref_=atv_dp_season_select_s5"), sonst leer. */
  const queryVon = (link) => /\/detail\/[A-Za-z0-9.-]+(\?[^#\s]*)/.exec(text(link))?.[1] ?? ''

  /**
   * Die Planeinträge einer Staffelliste, ohne die gerade offene Seite und ohne Dubletten.
   * `besucht`: Kennungen, deren erste Staffel schon läuft oder gelaufen ist (die offene Seite zeigt die
   * gewählte Staffel; jede andere Staffel derselben ASIN kommt über ihre Query).
   */
  globalThis.akPrimePlanEintraege = (staffeln, besucht, imPlan) => {
    const gesehen = new Set()
    const eintraege = []
    const sortiert = [...(staffeln ?? [])].filter((s) => s?.kennung).sort((a, b) => (a.nummer ?? 0) - (b.nummer ?? 0))
    const gewaehlteKennungen = new Set(sortiert.filter((s) => s.gewaehlt).map((s) => text(s.kennung)))
    for (const s of sortiert) {
      const k = text(s.kennung)
      const offen = besucht.includes(k) && (s.gewaehlt || (!gewaehlteKennungen.has(k) && !gesehen.has(k)))
      gesehen.add(k)
      if (offen) continue
      const erster = !besucht.includes(k) && !eintraege.some((e) => e.kennung === k)
      const query = queryVon(s.link)
      const eintrag = erster || !query ? k : k + query
      if (besucht.includes(eintrag) || imPlan.includes(eintrag) || eintraege.some((e) => e.eintrag === eintrag)) continue
      eintraege.push({ kennung: k, eintrag, nummer: s.nummer ?? null })
    }
    return eintraege
  }

  /** Frame-Adresse: Suchseiten tragen ihre volle Adresse, alles andere läuft über die Titelseite. */
  globalThis.akPrimeEintragAdresse = (eintrag, gtiMerken) =>
    /^https:\/\//.test(text(eintrag)) ? text(eintrag) : globalThis.akPrimeFrameAdresse(text(eintrag), gtiMerken)

  /** Die Kennung hinter einem Planeintrag („B0B6HHFR44?ref_=…" → „B0B6HHFR44"). */
  globalThis.akPrimeEintragKennung = (eintrag) => text(eintrag).split('?')[0]

  /**
   * Nach den Titeln: erst die Treffer einer schon gelesenen Suche, sonst die nächste offene Suche.
   * Ändert `lauf` (Warteschlange, geöffnete Suchen) und liefert, was der Lauf als Nächstes beginnt.
   */
  globalThis.akPrimeSucheWeiter = (lauf, offeneSuchen, suchliste) => {
    const einheit = (lauf.einheiten ?? []).shift()
    if (einheit) return { schluessel: einheit.kennung, eintrag: einheit.kennung, suche: einheit.suchUrl, art: 'treffer' }
    const geoeffnet = lauf.suchenGeoeffnet ?? []
    const url = offeneSuchen.find((u) => !geoeffnet.includes(u))
    if (!url) return null
    lauf.suchenGeoeffnet = [...geoeffnet, url]
    const begriff = suchliste[url]?.suchbegriff
    const adresse = begriff ? `https://www.amazon.de/s?k=${encodeURIComponent(begriff)}&i=instant-video` : url
    return { schluessel: url, eintrag: adresse, suche: url, art: 'suche' }
  }

  /** Der Auftrag, den die Zielseite im Tab-Speicher findet, damit ihr Meldeknopf weiß, wofür sie meldet. */
  globalThis.akPrimeZielAuftrag = (lauf, eintrag, suchliste) => ({
    ...suchliste[lauf.suche],
    suchUrl: lauf.suche,
    zielAsin: globalThis.akPrimeEintragKennung(eintrag),
  })

  /** Antwort eines Such-Frames: seine Treffer kommen als Einheiten in die Warteschlange, der Rest als Vermerk. */
  globalThis.akPrimeSucheErgebnis = (lauf, daten, name) => {
    if (!Array.isArray(daten.treffer)) return
    const schon = new Set((lauf.einheiten ?? []).map((e) => e.kennung))
    const neu = daten.treffer.map(text).filter((k) => k && !schon.has(k))
    lauf.einheiten = [...(lauf.einheiten ?? []), ...neu.map((kennung) => ({ kennung, suchUrl: lauf.titel }))]
    if (daten.ok && !daten.treffer.length) lauf.uebersprungen.push(`${name} · ${text(daten.grund)}`)
  }

  const KARTEN_WARTEN_MS = 3000
  const SEITE_HOECHSTENS_MS = 25_000

  /**
   * Das Urteil des Such-Frames: noch warten (`null`) oder fertig mit `{ ok, grund, treffer }`.
   * Besucht werden nur Treffer, die der Abgleich als **genau** liest, dazu die von Daniel bestätigten
   * Ausgaben; „ähnlich" und „keiner" bleiben Handarbeit und werden benannt, nie als „nicht bei Prime" gemeldet.
   */
  globalThis.akPrimeSucheUrteil = ({ auftrag, gefunden, befund, erwartet, vergangen, kennungAus }) => {
    if (!auftrag) return vergangen > 8000 ? { ok: false, grund: 'Suchauftrag nicht erkannt', treffer: [] } : null
    const gelesen = gefunden.gesehen > 0 || gefunden.leerGemeldet
    if (!gelesen || befund?.art === 'unklar') {
      return vergangen > SEITE_HOECHSTENS_MS ? { ok: false, grund: 'Trefferliste nicht gelesen', treffer: [] } : null
    }
    if (vergangen < KARTEN_WARTEN_MS) return null
    const kennungen = (liste) => [...new Set(liste.map((t) => kennungAus(t.url)).filter(Boolean))]
    const bestaetigt = (erwartet ?? []).map(text)
    if (befund.art === 'genau') {
      return { ok: true, grund: 'Treffer gelesen', treffer: [...new Set([...kennungen(befund.treffer), ...bestaetigt])] }
    }
    const grund = befund.art === 'aehnlich' ? 'nur ähnliche Treffer — von Hand' : 'kein Treffer — von Hand'
    return { ok: true, grund: bestaetigt.length ? 'bestätigte Auswahl gelesen' : grund, treffer: bestaetigt }
  }

  /** Die letzten Knopftexte mit Zeit seit Seitenstart — was ein Frame zeigte, bevor er scheiterte. */
  globalThis.akPrimeTagebuch = (bisher, textJetzt, nachMs) =>
    text(textJetzt) && text(bisher?.[bisher.length - 1]?.text) !== text(textJetzt)
      ? [...(bisher ?? []), { ms: nachMs, text: text(textJetzt).slice(0, 80) }].slice(-8)
      : (bisher ?? [])
}
