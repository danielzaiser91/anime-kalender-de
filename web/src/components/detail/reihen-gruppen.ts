import type { FranchiseMember } from '@shared/types.ts'
import { zaehlgruppen } from '@shared/titles.ts'

type GruppenText = 'detail.gruppeStaffeln' | 'detail.gruppeEigene' | 'detail.gruppeNeuverfilmung' | 'detail.gruppeFilme' | 'detail.gruppeSpecials'

/**
 * Die Gruppen der Reihenliste: Hauptserie, eigene Serien (Fortsetzungen mit eigenem Titel, keine
 * Staffeln — Korra neben „Der Herr der Elemente", 11.10.2026), Filme, Specials. Eine Neuverfilmung samt
 * ihren Fortsetzungen steht in einer eigenen Gruppe unter der Hauptserie (Yaiba 2025, 26.10.2026).
 */
export function reihenGruppen(
  teile: FranchiseMember[],
  istHauptstaffel: (m: FranchiseMember) => boolean,
  sortiere: (a: FranchiseMember, b: FranchiseMember) => number,
  t: (schluessel: GruppenText) => string,
): { titel: string; teile: FranchiseMember[] }[] {
  const eigen = (m: FranchiseMember) => Boolean(m.eigenesWerk)
  const [haupt = [], ...neuverfilmungen] = zaehlgruppen(teile.filter(istHauptstaffel))
  return [
    { titel: t('detail.gruppeStaffeln'), teile: haupt.sort(sortiere) },
    ...neuverfilmungen.map((g) => ({ titel: t('detail.gruppeNeuverfilmung'), teile: g.sort(sortiere) })),
    { titel: t('detail.gruppeEigene'), teile: teile.filter(eigen).sort(sortiere) },
    /* Filme vor Specials: Ein Film ist ein eigenständiges Werk der Reihe, ein Special ist Beiwerk. */
    { titel: t('detail.gruppeFilme'), teile: teile.filter((m) => !eigen(m) && m.format === 'MOVIE').sort(sortiere) },
    {
      titel: t('detail.gruppeSpecials'),
      teile: teile.filter((m) => !istHauptstaffel(m) && !eigen(m) && m.format !== 'MOVIE').sort(sortiere),
    },
  ].filter((g) => g.teile.length > 0)
}
