import type { FranchiseMember } from '@shared/types.ts'

/**
 * Die Gruppen der Reihenliste: Hauptserie, eigene Serien (Fortsetzungen mit eigenem Titel, keine
 * Staffeln — Korra neben „Der Herr der Elemente", 11.10.2026), Filme, Specials.
 */
export function reihenGruppen(
  teile: FranchiseMember[],
  istHauptstaffel: (m: FranchiseMember) => boolean,
  sortiere: (a: FranchiseMember, b: FranchiseMember) => number,
  t: (schluessel: 'detail.gruppeStaffeln' | 'detail.gruppeEigene' | 'detail.gruppeFilme' | 'detail.gruppeSpecials') => string,
): { titel: string; teile: FranchiseMember[] }[] {
  const eigen = (m: FranchiseMember) => Boolean(m.eigenesWerk)
  return [
    { titel: t('detail.gruppeStaffeln'), teile: teile.filter(istHauptstaffel).sort(sortiere) },
    { titel: t('detail.gruppeEigene'), teile: teile.filter(eigen).sort(sortiere) },
    /* Filme vor Specials: Ein Film ist ein eigenständiges Werk der Reihe, ein Special ist Beiwerk. */
    { titel: t('detail.gruppeFilme'), teile: teile.filter((m) => !eigen(m) && m.format === 'MOVIE').sort(sortiere) },
    {
      titel: t('detail.gruppeSpecials'),
      teile: teile.filter((m) => !istHauptstaffel(m) && !eigen(m) && m.format !== 'MOVIE').sort(sortiere),
    },
  ].filter((g) => g.teile.length > 0)
}
