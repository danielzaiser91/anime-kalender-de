// Staffelprüfung für Anime2You-Zitate: Ein Zitat, das eine Staffel nennt, belegt nur die Adresse dieser Staffel
// (Skill synchro-belegen „Beleg gilt nur für die genannte Staffel“; Block 10 trug „erste Staffel“ an einer Staffel-2-Adresse, 18.11.2026).
const ORDNUNG = { erste: 1, zweite: 2, dritte: 3, vierte: 4, fünfte: 5, sechste: 6, siebte: 7, achte: 8, neunte: 9, zehnte: 10 }
const STAFFEL = /\b(?:(erste|zweite|dritte|vierte|fünfte|sechste|siebte|achte|neunte|zehnte)[nrs]?\s+(?:Staffel|Season)|(?:Staffel|Season)\s+(\d+))/gi
const FOLGEN_TOLERANZ = 2
const KURZE_SERIE = 30

/** Die im Zitat genannten Staffelnummern (leer, wenn keine genannt ist). */
export function zitatStaffeln(zitat) {
  return [...String(zitat).matchAll(STAFFEL)].map((m) => (m[1] ? ORDNUNG[m[1].toLowerCase()] : Number(m[2])))
}

/** Staffel der Adresse laut Notiz („laut Adresse Staffel N“) und die dort geprüfte Folgenzahl („alle N Folgen geprüft“); null, wenn nicht genannt. */
export function adressStaffel(note) {
  const s = /laut Adresse Staffel (\d+)/.exec(note || '')
  const f = /alle (\d+) Folgen? geprüft/.exec(note || '')
  return { staffel: s ? Number(s[1]) : null, folgen: f ? Number(f[1]) : null }
}

/**
 * Passt das Zitat zur Adresse? `urteil`: „passt“ (Zitat ohne Staffel oder gleiche Adress-Staffel), „abweichung“ (andere Adress-Staffel oder bei
 * einem AniList-Titel mit höchstens 30 Folgen eine Adresse mit deutlich anderer Folgenzahl), sonst „unbekannt“ (Staffel der Adresse steht nicht fest:
 * das Zitat gehört dort nicht hin, solange sie fehlt).
 */
export function pruefeStaffel(zitat, note, anilistFolgen = null) {
  const genannt = zitatStaffeln(zitat)
  if (!genannt.length) return { urteil: 'passt', grund: 'Zitat nennt keine Staffel' }
  const { staffel, folgen } = adressStaffel(note)
  if (staffel !== null) {
    return genannt.includes(staffel)
      ? { urteil: 'passt', grund: `Adresse Staffel ${staffel}` }
      : { urteil: 'abweichung', grund: `Zitat nennt Staffel ${genannt.join('/')}, die Adresse ist Staffel ${staffel}` }
  }
  if (anilistFolgen && anilistFolgen <= KURZE_SERIE && folgen !== null && Math.abs(folgen - anilistFolgen) > FOLGEN_TOLERANZ) {
    return { urteil: 'abweichung', grund: `Zitat nennt Staffel ${genannt.join('/')}, die Adresse deckt ${folgen} Folgen, der AniList-Titel ${anilistFolgen}` }
  }
  return { urteil: 'unbekannt', grund: `Zitat nennt Staffel ${genannt.join('/')}, die Staffel der Adresse steht nicht fest` }
}

/** Urteil je Zeile eines Titels in dub-confirmed.yaml (nur Zeilen mit Adresse); `anilistFolgen` aus titles.json. */
export function pruefeTitel(eintraege, anilistId, zitat, anilistFolgen = null) {
  return eintraege
    .filter((e) => e.anilistId === anilistId && e.url)
    .map((e) => ({ url: e.url, ...pruefeStaffel(zitat, e.note, anilistFolgen) }))
}
