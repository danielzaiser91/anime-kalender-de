import type { Release, Title } from '@shared/types.ts'

/**
 * **Der aniSearch-Tag der deutschen Fassung ist veraltet, wenn Band 1 noch aussteht.** Virgin Road: aniSearch 11.04.2026,
 * die Blu-ray Vol. 1 wurde auf 30.10.2026 verschoben (anime2you), der Kasten sagte „Auf Deutsch“. Ohne erschienene Disc und mit
 * einem künftigen „Vol. 1“ ist der erste deutsche Termin der des Bandes. Ein Box-Neuauflage-Termin (kein „Vol. 1“) zählt nicht.
 */
export function ersteDiscNochOffen(releases: Release[], heute: string): boolean {
  const discs = releases.filter((r) => r.platform === 'disc')
  const datum = (r: Release) => r.schedule?.firstEpisodeDate ?? ''
  return discs.every((r) => datum(r) > heute) && discs.some((r) => /\bVol\.?\s*1\b/.test(r.name))
}

/**
 * Die eine Regel hinter Kasten, Neuigkeiten und Entdecken-Stufe: Der Tag der Erstausgabe (`deErstausgabe.von` bis heute)
 * zählt nicht, solange Vol. 1 aussteht — es sei denn, ein deutscher Stream oder ein erschienener Nicht-Disc-Termin
 * belegt den früheren Beginn (Yamada-kun: Netflix-Dub, Vol. 1 erst im November).
 */
export function erstausgabeVorDisc(title: Pick<Title, 'streams'>, releases: Release[], heute: string): boolean {
  if ((title.streams ?? []).some((s) => s.dub === true)) return false
  const frueherNichtDisc = releases.some((r) => r.platform !== 'disc' && (r.schedule?.firstEpisodeDate ?? '9') <= heute)
  return !frueherNichtDisc && ersteDiscNochOffen(releases, heute)
}

/** Der früheste Disc-Termin (Vol. 1 steht aus): ab dann beginnt die deutsche Fassung. */
export function ersterDiscTermin(releases: Release[]): string {
  return releases.filter((r) => r.platform === 'disc').map((r) => r.schedule?.firstEpisodeDate ?? '').sort()[0] ?? ''
}
