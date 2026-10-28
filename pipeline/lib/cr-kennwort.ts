/** Der unterscheidende Teil eines Filmtitels: der Rest nach dem letzten Trenner („ – “, „ - “, „ — “, „:“). */
import { normSchluessel } from './util.ts'

const TRENNER = /\s[-–—:]\s|\s*:\s*/

const teile = (s?: string | null) => (s ?? '').split(TRENNER).filter(Boolean)

export const kennwortRoh = (s?: string | null) => {
  const t = teile(s)
  return (t[t.length - 1] ?? s ?? '').replace(/[~„"]/g, '').trim()
}

export const kennwort = (s?: string | null) => {
  const t = teile(s)
  return normSchluessel(t[t.length - 1] ?? s)
}
