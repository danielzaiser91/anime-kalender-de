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
 * - **Suchaufträge (20.11.2026):** nur noch eine Auswahl. Daniel kreuzt auf der Suchseite die Karten an (beim Worker
 *   gespeichert, `erwartungMelden`); jede gewählte Karte ist eine Zeile der Prüfliste, und der Lauf besucht sie wie
 *   einen Titel mit seinen Staffeln, jeweils einen Frame zugleich. Der Lauf öffnet nie eine Suchseite.
 */
{
  const text = (v) => String(v ?? '')

  /** Die Query hinter der Kennung im `seasonLink` („?ref_=atv_dp_season_select_s5"), sonst leer. */
  const queryVon = (link) => /\/detail\/[A-Za-z0-9.-]+(\?[^#\s]*)/.exec(text(link))?.[1] ?? ''

  /**
   * Die Planeinträge einer Staffelliste, ohne die gerade offene Seite und ohne Dubletten.
   * `besucht`: Kennungen, deren erste Staffel schon läuft oder gelaufen ist (die offene Seite zeigt die
   * gewählte Staffel; jede andere Staffel derselben ASIN kommt über ihre Query).
   *
   * **Nichts fällt still heraus:** Jeder Eintrag, der nicht in den Plan kommt, obwohl er eine eigene Staffel
   * sein müsste (keine Kennung, keine Query, gleiche Query), steht mit Grund in `verloren`.
   */
  globalThis.akPrimePlanEintraege = (staffeln, besucht, imPlan) => {
    const gesehen = new Set()
    const eintraege = []
    const verloren = []
    const name = (s) => text(s?.name || (s?.nummer ?? '?'))
    const sortiert = [...(staffeln ?? [])].sort((a, b) => (a?.nummer ?? 0) - (b?.nummer ?? 0))
    const gewaehlteKennungen = new Set(sortiert.filter((s) => s?.gewaehlt).map((s) => text(s.kennung)))
    for (const s of sortiert) {
      if (!s?.kennung) {
        verloren.push(`${name(s)}: ohne Kennung`)
        continue
      }
      const k = text(s.kennung)
      const offen = besucht.includes(k) && (s.gewaehlt || (!gewaehlteKennungen.has(k) && !gesehen.has(k)))
      gesehen.add(k)
      if (offen) continue
      const erster = !besucht.includes(k) && !eintraege.some((e) => e.kennung === k)
      const query = queryVon(s.link)
      const eintrag = erster || !query ? k : k + query
      if (besucht.includes(eintrag) || imPlan.includes(eintrag) || eintraege.some((e) => e.eintrag === eintrag)) {
        verloren.push(`${name(s)}: ${query ? 'gleicher Link wie ein anderer Eintrag' : 'kein Link, der sie von der offenen Seite trennt'}`)
        continue
      }
      eintraege.push({ kennung: k, eintrag, nummer: s.nummer ?? null })
    }
    return { eintraege, verloren }
  }

  /** Die Warnzeile für die Handliste, wenn Einträge des Dropdowns nicht in den Plan kamen; sonst `null`. */
  globalThis.akPrimeStaffelWarnung = (verloren, gesamt, name) =>
    verloren.length ? `${name} · Dropdown: ${verloren.length} von ${gesamt} Einträgen nicht unterscheidbar (${verloren.slice(0, 3).join('; ')})` : null

  /** Frame-Adresse: Suchseiten tragen ihre volle Adresse, alles andere läuft über die Titelseite. */
  globalThis.akPrimeEintragAdresse = (eintrag, gtiMerken) =>
    /^https:\/\//.test(text(eintrag)) ? text(eintrag) : globalThis.akPrimeFrameAdresse(gtiOhneQuery(text(eintrag)), gtiMerken)

  /** Eine gti trägt nie eine Query: Sie geht in `gtiMerken` und in die Adresse von watch.amazon.de. */
  const gtiOhneQuery = (e) => (e.startsWith('amzn1.dv.gti.') ? e.split('?')[0] : e)

  /** Die Kennung hinter einem Planeintrag („B0B6HHFR44?ref_=…" → „B0B6HHFR44"). */
  globalThis.akPrimeEintragKennung = (eintrag) => text(eintrag).split('?')[0]

  /** Alle Karten der Suchseite, jede Kennung einmal, in Seitenreihenfolge. */
  globalThis.akPrimeAuswahlKarten = (treffer, kennungAus) => {
    const gesehen = new Set()
    const karten = []
    for (const t of treffer ?? []) {
      const kennung = kennungAus(t?.url)
      if (!kennung || gesehen.has(kennung)) continue
      gesehen.add(kennung)
      karten.push({ kennung, titel: text(t.titel), typ: text(t.typ), kanal: /channel|subscription/i.test(text(t.zugang)) })
    }
    return karten
  }

  /** Die Zeilen der Prüfliste: je gewählte Karte eine, mit dem Stand der Seite (`gemeldet(kennung)`). */
  globalThis.akPrimeAuswahlZeilen = (erwartungen, kopf, gemeldet) => {
    const zeilen = []
    for (const [suchUrl, kennungen] of Object.entries(erwartungen ?? {})) {
      if (!Array.isArray(kennungen)) continue
      const k = kopf(suchUrl) ?? {}
      for (const kennung of kennungen.map(text)) {
        zeilen.push({ kennung, suchUrl, titel: text(k.titel) || 'Prime-Treffer', folgen: k.folgen ?? null, gemeldet: Boolean(gemeldet(kennung)) })
      }
    }
    return zeilen
  }

  /** Was der Lauf besucht: die noch offenen gewählten Karten. */
  globalThis.akPrimeAuswahlEinheiten = (zeilen) => zeilen.filter((z) => !z.gemeldet).map((z) => ({ kennung: z.kennung, suchUrl: z.suchUrl }))

  /**
   * Nach den Titeln: die nächste gewählte Karte. Gibt es keine, ist der Lauf fertig; Suchseiten öffnet er nie.
   * Ändert `lauf` (Warteschlange) und liefert, was der Lauf als Nächstes beginnt.
   */
  globalThis.akPrimeSucheWeiter = (lauf, einheitenNeu) => {
    if (!lauf.auswahlVerteilt) {
      lauf.einheiten = [...(lauf.einheiten ?? []), ...einheitenNeu()]
      lauf.auswahlVerteilt = true
    }
    const einheit = (lauf.einheiten ?? []).shift()
    return einheit ? { schluessel: einheit.kennung, eintrag: einheit.kennung, suche: einheit.suchUrl, art: 'treffer' } : null
  }

  /** Der Auftrag, den die Zielseite im Tab-Speicher findet, damit ihr Meldeknopf weiß, wofür sie meldet. */
  globalThis.akPrimeZielAuftrag = (lauf, eintrag, kopf) => ({
    ...kopf(lauf.suche),
    suchUrl: lauf.suche,
    zielAsin: globalThis.akPrimeEintragKennung(eintrag),
  })
  /** Überschrift einer Gruppe der Prüfliste: sagt ohne Klick, wie viele offen und wie viele erledigt sind. */
  globalThis.akPrimeSuchUeberschrift = (name, offen, gesamt) => {
    if (!offen) return `${name}: ${gesamt} erledigt, keine offen`
    return `${name}: ${offen} offen${gesamt > offen ? `, ${gesamt - offen} erledigt` : ''}`
  }

  /**
   * Die Auswahlgruppe im Kasten der Suchseite. `d` trägt die Bausteine des Kastens und die Handlungen,
   * damit hier kein Zugriff auf `amazon.js` nötig ist.
   * - `karten`: Ergebnis von `akPrimeAuswahlKarten`; `gewaehlt`: schon beim Worker gespeicherte Kennungen.
   * - `speichern(kennungen)`: liefert ein Promise mit `true`, wenn die Auswahl beim Worker liegt.
   */
  globalThis.akPrimeAuswahlGruppe = (d) => {
    const gruppe = document.createElement('div')
    gruppe.className = 'ak-such-gruppe'
    gruppe.appendChild(d.zeile('ak-such-hinweis', 'Kreuze alle Karten an, die zu diesem Titel gehören, jede Staffel einzeln.'))
    const bereits = new Set((d.gewaehlt ?? []).map(text))
    for (const k of d.karten) {
      const name = `${k.kanal ? 'Kanal-Abo' : 'Kauf/Abo'} · ${(k.titel || 'Ausgabe').slice(0, 40)}`
      gruppe.appendChild(d.auswahl(name, k.kennung, bereits.has(k.kennung)))
    }
    const reihe = document.createElement('div')
    reihe.className = 'ak-such-knopfreihe'
    const knopf = d.knopf(bereits.size ? `${bereits.size} in der Prüfliste` : 'Auswahl übernehmen', (k) => {
      const gewaehlt = [...gruppe.querySelectorAll('.ak-such-auswahl input:checked')].map((b) => /** @type {HTMLElement} */ (b).dataset.kennung).filter(Boolean)
      if (!gewaehlt.length) {
        k.textContent = 'Erst Karten ankreuzen'
        return
      }
      k.disabled = true
      k.textContent = 'speichere …'
      void d.speichern(gewaehlt).then((ok) => {
        k.disabled = ok
        k.textContent = ok ? `${gewaehlt.length} in der Prüfliste` : 'nicht gesendet – noch einmal'
        if (ok) zurueck.hidden = false
      })
    })
    knopf.disabled = bereits.size > 0
    const zurueck = d.knopf('↺', () => {
      zurueck.hidden = true
      void d.speichern([]).then(() => {
        knopf.textContent = 'Auswahl übernehmen'
        knopf.disabled = false
      })
    })
    zurueck.title = 'Auswahl zurücknehmen'
    zurueck.classList.add('ak-suchknopf-klein')
    zurueck.hidden = !bereits.size
    reihe.append(knopf, zurueck)
    gruppe.appendChild(reihe)
    return gruppe
  }

  /** Die letzten Knopftexte mit Zeit seit Seitenstart — was ein Frame zeigte, bevor er scheiterte. */
  globalThis.akPrimeTagebuch = (bisher, textJetzt, nachMs) =>
    text(textJetzt) && text(bisher?.[bisher.length - 1]?.text) !== text(textJetzt)
      ? [...(bisher ?? []), { ms: nachMs, text: text(textJetzt).slice(0, 80) }].slice(-8)
      : (bisher ?? [])
}
