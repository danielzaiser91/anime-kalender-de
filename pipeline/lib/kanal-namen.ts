/**
 * Kanalnamen aus dem Abo-Teil einer Meldungsnotiz („Abos: crunchyrollde (Meldung 4738), …").
 * Ein Zusatz in Klammern gehört nicht zum Kanal (22.09.2026): „crunchyrollde (meldung 4738)" passte auf
 * kein JustWatch-Angebot, die Probe fiel auf alle Angebote zurück und meldete einen Widerspruch, den es im
 * Kanal-Angebot nicht gibt (A Silent Voice).
 */
export function kanalNamen(note: string | undefined): string[] {
  return (/Abos: ([^—]*?)(?:, zugang=|, Seitenadresse|\s—|$)/.exec(note ?? '')?.[1] ?? '')
    .split(/,\s*/)
    .map((a) => a.replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase().replace(/de$/, ''))
    .filter((a) => a && a !== 'prime' && a !== 'keine angabe')
}
