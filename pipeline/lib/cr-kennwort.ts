/** Der unterscheidende Teil eines Filmtitels: alles nach dem letzten Trenner. */
import { normSchluessel } from './util.ts'

export const kennwortRoh = (s?: string | null) => {
  const t = (s ?? '').split(/s[-–—:]s|s*:s*/).filter(Boolean)
  return (t[t.length - 1] ?? s ?? '').replace(/[~„"]/g, '').trim()
}

export const kennwort = (s?: string | null) => {
  const t = (s ?? '').split(/\s[-–—:]\s|\s*:\s*/).filter(Boolean)
  return normSchluessel(t[t.length - 1] ?? s)
}
