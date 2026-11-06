/**
 * Ratsche (Stand 03.11.2026): Blöcke von `data/dub-confirmed.yaml`, deren Seite laut Bestand einem anderen Titel
 * gehört, Schlüssel `<Kennung>@<Seite>`. Nur streichen, nie ergänzen; Ziel 0. Von 61 Altfällen vom 02.11.2026 sind 47 abgearbeitet
 * (Fremdblöcke entfernt und in `data/belege-entfernt.yaml` gesperrt). Offen: ein Prime-Beleg aus PR 2701 (Classroom of the Elite 146066; Haganai 10719, K 20913 und CotE 180745 sind inzwischen entfernt/gesperrt)
 * und zehn ungeklärte Paare (Sylvanian Families, Ribbit, Tokyo Ghoul ×3,
 * Slime S2, Edens Zero, Captain Tsubasa Junior Youth ×2, GITS 2nd GIG); Gründe in `daniel-zum-abarbeiten/berichte/notizseite-altfaelle-2026-11-03.md`.
 */
export const ALTFAELLE: string[] = [
  '-13247@B07XYDCVFK',
  '10011569@B0DJ4FCM5H',
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
