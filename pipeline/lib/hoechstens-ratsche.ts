/**
 * Gemeinsamer Kern der `*_HOECHSTENS`-Ratschen (`check-remake-zaehlung`, `check-cover-vorschau-bestand`, `check-teilseiten`):
 * Eine Zahl darf nur sinken; die Grenze steht als Konstante beim Wächter.
 */
export function ueberHoechstens(anzahl: number, hoechstens: number): boolean {
  return anzahl > hoechstens
}
