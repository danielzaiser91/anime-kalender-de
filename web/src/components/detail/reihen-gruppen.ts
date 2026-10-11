import type { FranchiseMember } from '@shared/types.ts'

/** Die Gruppen der Reihenliste: Hauptserie, Filme, Specials. */
export function reihenGruppen(
  teile: FranchiseMember[],
  istHauptstaffel: (m: FranchiseMember) => boolean,
  sortiere: (a: FranchiseMember, b: FranchiseMember) => number,
  t: (schluessel: 'detail.gruppeStaffeln' | 'detail.gruppeFilme' | 'detail.gruppeSpecials') => string,
): { titel: string; teile: FranchiseMember[] }[] {
  return [
    { titel: t('detail.gruppeStaffeln'), teile: teile.filter(istHauptstaffel).sort(sortiere) },
    /* Filme vor Specials: Ein Film ist ein eigenständiges Werk der Reihe, ein Special ist Beiwerk. */
    { titel: t('detail.gruppeFilme'), teile: teile.filter((m) => m.format === 'MOVIE').sort(sortiere) },
    { titel: t('detail.gruppeSpecials'), teile: teile.filter((m) => !istHauptstaffel(m) && m.format !== 'MOVIE').sort(sortiere) },
  ].filter((g) => g.teile.length > 0)
}
