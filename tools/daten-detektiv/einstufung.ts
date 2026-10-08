/**
 * Hebel je Regel = Nutzerwirkung × Sicherheit.
 *
 * `wirkung`: 3 = Falschaussage auf Kalenderkarte, Panel-Kopf oder in den News; 2 = Nebenangabe im
 * Panel oder fehlende Auskunft; 1 = innere Unordnung ohne sichtbare Folge.
 * `sicherheit`: Anteil echter Fehler in der Handstichprobe (1 − Fehlalarmquote). Die Stichprobe vom
 * 08.10.2026 steht je Regel in `stichprobe` und in `docs/wissen/daten-detektiv.md`; ohne Treffer 0,5.
 * `empfehlung`: `hart` = Bau-Invariante (bricht den Bau ab), `weich` = Wache-Warnung, `nein` = nicht laufen lassen.
 */
export interface Einstufung { wirkung: 1 | 2 | 3; sicherheit: number; empfehlung: 'hart' | 'weich' | 'nein'; stichprobe?: string }

export const EINSTUFUNG: Record<string, Einstufung> = {
  'D-01': { wirkung: 3, sicherheit: 1.0, empfehlung: 'hart', stichprobe: '08.10.2026: 1/1 echt (Lycoris Recoil, B-05); 4 TV-Sichtungen mit Wiederholungen sind ausgenommen' },
  'D-06': { wirkung: 3, sicherheit: 1.0, empfehlung: 'hart', stichprobe: '08.10.2026: 6/6 — Handbeleg dub:true (Our Last Crusade S2, Prime), aniSearch „d" (Scott Pilgrim, Rick and Morty, BeyWheelz, Titipo 2), JustWatch de-Ton (FMA 4-koma)' },
  'D-17': { wirkung: 2, sicherheit: 1.0, empfehlung: 'weich', stichprobe: '08.10.2026: 8/8 — Slugs in news.json existieren in releases.json nicht (umbenannt: adn-1423-… → auto-116589-adn; Disc-Slugs abgeschnitten); neuigkeiten.tsx fällt dann auf die Anbieterseite zurück' },
  'D-23': { wirkung: 3, sicherheit: 1.0, empfehlung: 'hart', stichprobe: '08.10.2026: 0 Treffer (Riegel in termineAusPlan greift)' },
  'D-24': { wirkung: 3, sicherheit: 1.0, empfehlung: 'weich', stichprobe: '08.10.2026: 16/16 per Definition echt (B-01) — fast nur Specials/OVAs älterer Serien, Quelle vermutlich MyDubList' },
  'D-13': { wirkung: 3, sicherheit: 0.67, empfehlung: 'hart', stichprobe: '08.10.2026: 2/3 echt (zwei Kinofilme bei ProSieben MAXX mit „2 Folgen" = 2 Sendungen); Steel Ball Run ONA ist die bekannte Ausnahme' },
  'D-02': { wirkung: 3, sicherheit: 0.86, empfehlung: 'weich', stichprobe: '08.10.2026: 6/7 echt — 86 (ADN: 23 Folgen auf dem 11-Folgen-Titel = beide Staffeln), Wolf’s Rain 30/26, Clannad 25/23, Sankarea 13/12, zwei TV-Filme; Air Gear 26/25 ist in `herkunft` erklärt' },
  'D-11': { wirkung: 2, sicherheit: 1.0, empfehlung: 'weich', stichprobe: '08.10.2026: 13/13 — alles Disney+-Katalogaufnahmen aus batch-2026.yaml ohne `dateMeaning`, deutsche Fassung laut aniSearch 2003–2023; Panel sagt „im Angebot ab", die News „angekündigt" — Typ-Vertrag (`premiere` = erschien) verletzt' },
  'D-19': { wirkung: 2, sicherheit: 1.0, empfehlung: 'weich', stichprobe: '08.10.2026: 3/3 per Daten echt (86 bei ADN, Kamisama Kiss und Kotesashi-kun bei Prime: Termin ohne Weg und ohne platformUrl)' },
  'D-16': { wirkung: 2, sicherheit: 1.0, empfehlung: 'weich', stichprobe: '08.10.2026: 157/160 — 138 Amazon-Suchen (B-09), 19 ohne Kaufweg; bekannt, nur Zählung' },
  'D-08': { wirkung: 2, sicherheit: 0.75, empfehlung: 'weich', stichprobe: '08.10.2026: 4 Treffer, JustWatch-Tonspur nicht von Hand gegengeprüft (Prüfhierarchie: JustWatch unter Anbieter-API)' },
  'D-07': { wirkung: 2, sicherheit: 1.0, empfehlung: 'weich', stichprobe: '08.10.2026: 1/1 — Gantz 384 und 395 (2nd Stage) tragen dieselbe aniSearch-Kennung 585; MAL-Dubletten aniSearch↔AniList prüft schon check:logic' },
  'D-10': { wirkung: 3, sicherheit: 0.5, empfehlung: 'weich', stichprobe: '08.10.2026: 0 von 37 laufenden Wochen-Releases' },
  'D-03': { wirkung: 3, sicherheit: 0.5, empfehlung: 'weich', stichprobe: '08.10.2026: 0 404 unter 1.284 geprüften; 870 Wege (CR 672, ADN 139, YouTube 55) kennt link-check.json nicht — CR/ADN laufen über ihre Kataloge (verweise-entfernt.json)' },
  'D-12': { wirkung: 3, sicherheit: 0.5, empfehlung: 'weich', stichprobe: '08.10.2026: 0 Treffer; 16 MotN-Widersprüche sind durch gemessene Urteile (urteile.json „deutsch") entschieden — Prüfhierarchie karte.md §10' },
  'D-22': { wirkung: 2, sicherheit: 0.3, empfehlung: 'nein', stichprobe: '08.10.2026: 29/1.979; Stichprobe 5: Wolf’s Rain 30 = 26 + 4 OVA, Hamtaro 296 = Gesamtserie, Mermaid Forest 11/13, K-On!! 24/26 — meist andere Zählweise, keine Fehler bei uns' },
  'D-18': { wirkung: 1, sicherheit: 0.3, empfehlung: 'nein', stichprobe: '08.10.2026: 3 Bereiche über der Folgenzahl echt (B-12: Mushoku Tensei Cour 2, Kengan Ashura S2, Oshi no Ko); 26 sharedWith-Abweichungen zählen auch AniList-Titel außerhalb des Bestands' },
  'D-09': { wirkung: 1, sicherheit: 0.5, empfehlung: 'nein', stichprobe: '08.10.2026: 49/151 — Bündel und Pausen sind Normalfall, Stützpunkte fangen sie; nur Kennzahl' },
  'D-04': { wirkung: 2, sicherheit: 0.5, empfehlung: 'nein', stichprobe: '08.10.2026: 1 Treffer (Thunder 3: Beobachtung beginnt bei Folge 6) — die Termine tragen ohnehin „≈"' },
  'D-05': { wirkung: 2, sicherheit: 0.5, empfehlung: 'nein', stichprobe: '08.10.2026: 0 von 148 ohne Cover haben eine Zweitquelle (anisearch-cover, tmdb-poster, anisearch.json)' },
  'D-25': { wirkung: 1, sicherheit: 0.5, empfehlung: 'nein', stichprobe: '08.10.2026: 0 von 158 ohne Handlung haben eine aniSearch-Beschreibung' },
  'D-14': { wirkung: 2, sicherheit: 0.5, empfehlung: 'hart', stichprobe: '08.10.2026: 0 Treffer' },
  'D-15': { wirkung: 2, sicherheit: 0.5, empfehlung: 'hart', stichprobe: '08.10.2026: 0 Treffer (franchises.json führt nur Reihen ab zwei Gliedern)' },
  'D-20': { wirkung: 2, sicherheit: 0.5, empfehlung: 'weich', stichprobe: '08.10.2026: 0 von 129 künftigen Terminen' },
  'D-21': { wirkung: 2, sicherheit: 0.5, empfehlung: 'hart', stichprobe: '08.10.2026: 0 Treffer' },
}

export const hebel = (id: string): number => {
  const e = EINSTUFUNG[id] ?? { wirkung: 1, sicherheit: 0.5 }
  return e.wirkung * e.sicherheit
}
