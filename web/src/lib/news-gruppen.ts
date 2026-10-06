import type { NewsEintrag } from '@shared/types.ts'

/** Ab so vielen „auch bei …"-Einträgen an einem Tag werden sie unter einer Zeile eingeklappt (Joyn-Katalog: 20 bis 26 Einträge je Tag, 06.10.2026). */
export const GLEICHMELDER_AB = 4

/** Ein Eintrag, dessen Meldungen alle nur sagen „jetzt auch bei einem weiteren Anbieter". */
const istGleichmelder = (e: NewsEintrag): boolean => e.meldungen.length > 0 && e.meldungen.every((m) => m.art === 'neu' && m.weiterer)

/**
 * Trennt die Einträge eines Tages in die, die man liest, und die gleichförmigen „auch bei …"-Meldungen.
 * Bleiben es weniger als `GLEICHMELDER_AB`, bleibt alles beisammen — eine Sammelzeile für zwei Einträge wäre mehr Bedienung als Gewinn.
 */
export function teileGleichmelder(liste: NewsEintrag[]): { normal: NewsEintrag[]; gleich: NewsEintrag[] } {
  const gleich = liste.filter(istGleichmelder)
  return gleich.length >= GLEICHMELDER_AB ? { normal: liste.filter((e) => !istGleichmelder(e)), gleich } : { normal: liste, gleich: [] }
}

/** Wie viele Tage „Ältere News" je Klick zurückgeht. */
export const AELTERE_SCHRITT_TAGE = 14
