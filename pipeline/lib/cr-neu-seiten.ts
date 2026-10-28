/**
 * Wann der Katalogfund (`fetch-crunchyroll-neu.ts`) aufhört zu blättern. Der Katalog ist nach „neu hinzugefügt“ sortiert: Zeigt eine
 * Seite deutsche Folgen und kennt unsere Liste sie alle, liegt dahinter nur noch Bekanntes. Eine Seite ganz ohne deutsche Folge
 * sagt darüber nichts (die Folgen darunter können deutsch sein) — dann wird weiter gelesen.
 */
export function seiteNurBekannt(eintraege: Record<string, unknown>[], bekannt: ReadonlySet<string>): boolean {
  const deutsch = eintraege.filter((e) => (e.episode_metadata as Record<string, unknown> | undefined)?.audio_locale === 'de-DE')
  const guids = deutsch.map((e) => String(e.id ?? '')).filter(Boolean)
  return guids.length > 0 && guids.every((g) => bekannt.has(g))
}
