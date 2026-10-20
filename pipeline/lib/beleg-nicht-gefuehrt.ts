/** Der Beleg „available: false" für einen Titel, den der Anbieter unter der gemeldeten Adresse nicht führt (Ausgabe wie vorher inline in `fetch-pruefungen.ts`). */
export function nichtGefuehrtZeilen(
  id: number,
  titel: string | undefined,
  plattform: string,
  datum: string,
  anbieterStaffeln: number,
): string[] {
  return [
    '',
    `- anilistId: ${id}`,
    ...(titel ? [`  title: ${JSON.stringify(titel)}`] : []),
    `  platform: ${plattform}`,
    '  available: false',
    `  checkedAt: '${datum}'`,
    `  note: ${JSON.stringify(`Der Anbieter führt unter dieser Adresse nur ${anbieterStaffeln} Staffel(n); diese ist nicht darunter`)}`,
  ]
}
