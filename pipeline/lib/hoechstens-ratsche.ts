/**
 * Gemeinsamer Kern der `*_HOECHSTENS`-Ratschen (`check-remake-zaehlung`, `check-cover-vorschau-bestand`, `check-teilseiten`):
 * Eine Zahl darf nur sinken; die Grenze steht als Konstante beim Wächter.
 */
export function ueberHoechstens(anzahl: number, hoechstens: number): boolean {
  return anzahl > hoechstens
}

export interface RatschenOptionen<K> {
  /** Absichtlicher Abstand zwischen Bestand und Grenze (K47): erst darunter lohnt das Nachziehen. */
  luft?: number
  /** Bekannte Kennungen: abweichende Kennungen werden namentlich gemeldet, nicht nur gezählt. */
  bekannt?: readonly K[]
}

/**
 * `⚠ WARNUNG`-Zeilen (Exit bleibt 0, `tools/commit-data.sh` zeigt sie): neue Kennungen außerhalb der bekannten Liste, bekannte Kennungen,
 * die weg sind, und ein Bestand, der unter Grenze minus Luft liegt (dann die Grenze nachziehen).
 */
export function ratschenWarnzeilen<K extends string | number>(was: string, gefunden: readonly K[], hoechstens: number, optionen: RatschenOptionen<K> = {}): string[] {
  const { luft = 0, bekannt } = optionen
  const zeilen: string[] = []
  if (bekannt) {
    const neu = gefunden.filter((k) => !bekannt.includes(k))
    const weg = bekannt.filter((k) => !gefunden.includes(k))
    if (neu.length) zeilen.push(`  ⚠ WARNUNG ${was}: ${neu.length} Kennungen nicht in der bekannten Liste: ${neu.join(', ')}`)
    if (weg.length) zeilen.push(`  ⚠ WARNUNG ${was}: ${weg.length} bekannte Kennungen sind weg, aus der Liste streichen: ${weg.join(', ')}`)
  }
  if (gefunden.length + luft < hoechstens) zeilen.push(`  ⚠ WARNUNG ${was}: Bestand ${gefunden.length} liegt unter der Grenze ${hoechstens}, Grenze auf ${gefunden.length + luft} nachziehen`)
  return zeilen
}
