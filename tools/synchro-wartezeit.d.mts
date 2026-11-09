import type { Release } from '../shared/types.ts'
import type { CrDubData } from '../pipeline/lib/crunchyroll-dub.ts'

export function staffelnummern(omu: Release, cr: Release[]): number[] | null
/** Früheste datierte deutsche Folge (ms), `undefined` ohne eine, `{ unklar: Grund }` ohne zuordenbaren Block. */
export function fruehesteDeutsche(katalog: CrDubData, omu: Release, cr?: Release[]): number | undefined | { unklar: string }
