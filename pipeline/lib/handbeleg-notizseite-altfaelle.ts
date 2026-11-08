/**
 * Ratsche (Stand 03.11.2026): Blöcke von `data/dub-confirmed.yaml`, deren Seite laut Bestand einem anderen Titel
 * gehört, Schlüssel `<Kennung>@<Seite>`. Nur streichen, nie ergänzen; Ziel 0. Von 61 Altfällen vom 02.11.2026 sind 47 abgearbeitet
 * (Fremdblöcke entfernt und in `data/belege-entfernt.yaml` gesperrt). Am 05.11.2026 vier weitere als behoben gestrichen
 * (10011569, 10719, 180745, 20913); Sylvanian Families (-13247) löste #2917. Offen: Classroom of the Elite 146066 und neun ungeklärte Paare
 * (Ribbit, Tokyo Ghoul ×3, Slime S2, Edens Zero, Captain Tsubasa Junior Youth ×2, GITS 2nd GIG); Gründe in `daniel-zum-abarbeiten/berichte/notizseite-altfaelle-2026-11-03.md`.
 */
export const ALTFAELLE: string[] = [
  '108511@B0CJC11GRB',
  '146066@B0GGJKGT5P',
  '163024@B0GC9MPBHQ',
  '163024@B0GXPFJJZK',
  '20850@B0D83P6X34',
  '801@B0B8PKXRZ8',
]

/** Ratsche: die Liste darf nur kürzer werden; `grenze` ist der Stand, den die Zusicherung festschreibt. */
export function ratscheVerletzt(altfaelle: readonly string[], grenze: number): boolean {
  return altfaelle.length > grenze
}

/** Altfall-Liste der Wächter; Prozesstests setzen `AK_NOTIZSEITE_ALTFAELLE` (JSON-Liste) auf eigene Fixture-Fälle. */
export function leseAltfaelle(env: Record<string, string | undefined> = process.env): string[] {
  const roh = env.AK_NOTIZSEITE_ALTFAELLE
  return roh ? (JSON.parse(roh) as string[]) : ALTFAELLE
}
