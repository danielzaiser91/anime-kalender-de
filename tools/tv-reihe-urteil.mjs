/**
 * Urteilsregeln der Wischreihe „Im Fernsehen“ (Woche, unterhalb lg): reine Funktionen aus Messwerten, getestet in `tv-reihe-urteil.test.mjs`.
 * Die Messung selbst (Browser, Pixel) steht in `ansicht-tv-reihe.mjs`.
 */

/** Mindestgröße eines Tippziels in CSS-Pixeln (Skill web-best-practice). */
export const MIN_KNOPF = 44
/** Summe der Kanalabweichungen (RGB), bis zu der zwei Pixel als gleich gelten (Kantenglättung). */
export const GLEICH_BIS = 16
/** Ab dieser Summe unterscheidet sich der Rand deutlich von seiner Umgebung. */
export const DEUTLICH_AB = 24

const abstand = (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0)

/**
 * Eine Reihe, kein seitlicher Überlauf der Seite, Tippziele groß genug.
 * `m`: { oben: [top je Kachel], scrollBreite, fensterBreite, minKnopf, reiheScrollt }
 */
export function urteilReihe(m) {
  const f = []
  if (m.oben.length < 2) f.push(`nur ${m.oben.length} Kachel(n) gemessen`)
  const spanne = m.oben.length ? Math.max(...m.oben) - Math.min(...m.oben) : 0
  if (spanne > 1) f.push(`Kacheln stehen nicht in einer Reihe (Höhenunterschied ${spanne} px)`)
  if (!m.reiheScrollt) f.push('Reihe scrollt nicht seitlich (scrollWidth <= clientWidth)')
  if (m.scrollBreite > m.fensterBreite) f.push(`Seite scrollt waagerecht (${m.scrollBreite} > ${m.fensterBreite} px)`)
  if (m.minKnopf < MIN_KNOPF - 0.1) f.push(`Kachelknopf nur ${m.minKnopf} px hoch (< ${MIN_KNOPF})`)
  return f
}

/**
 * Tab setzt den Fokus auf eine Kachel außerhalb des Sichtbereichs, der Scroller macht sie sichtbar.
 * `m`: { fokusAufVerdeckter, scrollVorher, scrollNachher, sichtbar }
 */
export function urteilTastatur(m) {
  const f = []
  if (!m.fokusAufVerdeckter) f.push('Tab erreicht keine Kachel außerhalb des sichtbaren Bereichs')
  if (!(m.scrollNachher > m.scrollVorher)) f.push(`scrollLeft ändert sich nicht (${m.scrollVorher} -> ${m.scrollNachher})`)
  if (!m.sichtbar) f.push('fokussierte Kachel liegt nicht im Sichtbereich der Reihe')
  return f
}

/**
 * Rand und Rundung einer Kachel an Pixeln (je Thema).
 * `m`: { grund, rand: Pixel auf der letzten Kantenzeile mittig, ecke: Pixel der unteren Ecke, darunter: [Pixel 1..3 px unter der Kante] }
 * Rand deutlich anders als der Grund (sichtbar, nicht abgeschnitten), Ecke wie der Grund (rund), Zeilen darunter wie der Grund (kein Rest, kein Abschneiden).
 */
export function urteilRand(m) {
  const f = []
  if (abstand(m.rand, m.grund) < DEUTLICH_AB) f.push('Unterkante der Kachel nicht sichtbar (gleich dem Grund, abgeschnitten?)')
  if (abstand(m.ecke, m.grund) > GLEICH_BIS) f.push('untere Ecke ist nicht gerundet (Pixel ist nicht Grund)')
  m.darunter.forEach((p, i) => {
    if (abstand(p, m.grund) > GLEICH_BIS) f.push(`${i + 1} px unter der Kante steht ein Rest (nicht Grund)`)
  })
  return f
}

/** Legt `anzahl` Fernsehtermine (je anderer Sender, sonst bündelt die App sie) auf den Tag `datum`; Vorlage ist ein vorhandener Termin. */
export function tvKulisse(events, datum, anzahl) {
  const vorlage = events.find((e) => e.platform === 'tv') ?? events[0]
  if (!vorlage) return events
  const neu = Array.from({ length: anzahl }, (_, i) => ({
    ...vorlage,
    sender: `Kulissensender ${i + 1}`,
    time: `${String(6 + i).padStart(2, '0')}:00`,
    platform: 'tv',
    date: datum,
    id: `${vorlage.releaseSlug}@kulisse-tv-${i}-${datum}`,
  }))
  return [...events, ...neu]
}
