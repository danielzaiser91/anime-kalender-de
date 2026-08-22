/**
 * Passt eine Adresse zu dem Anbieter, unter dem sie steht?
 *
 * aniSearch nennt den Anbieter als Namen und die Adresse getrennt — und die
 * beiden gehören nicht immer zusammen. Am 22.08.2026 standen unter
 * „Crunchyroll" zwei Adressen, die nirgends dorthin führen: bei „Attack on
 * Titan: The Roar of Awakening" ein Amazon-Link, bei „NANA" eine
 * Google-Weiterleitung. Beide landeten als Crunchyroll-Verweis im Datensatz,
 * beide kosteten bei jedem Abruflauf einen Aufruf und lieferten nie etwas.
 *
 * Der Name allein darf also nicht entscheiden.
 */
import { PLATFORMS, type PlatformId } from './types.ts'

/** Woran eine Adresse ihren Anbieter erkennen lässt. */
const HOSTS: Record<PlatformId, string[]> = {
  crunchyroll: ['crunchyroll.com'],
  netflix: ['netflix.com'],
  primevideo: ['primevideo.com', 'amazon.de', 'amazon.com'],
  disneyplus: ['disneyplus.com'],
  // `.de` ist ADNs deutsche Domain und die häufigste in unseren Daten (75 von
  // 76 Verweisen) — sie zu vergessen hätte fast alle ADN-Verweise verworfen.
  adn: ['animationdigitalnetwork.de', 'animationdigitalnetwork.com', 'animedigitalnetwork.fr'],
  aniverse: ['aniverse.de', 'aniverse-mediathek.de'],
  wow: ['wowtv.de', 'sky.de'],
  joyn: ['joyn.de'],
  // TVNow ist der alte Name von RTL+; aniSearch führt beide Formen.
  rtlplus: ['rtlplus.com', 'rtl.de', 'tvnow.de'],
  youtube: ['youtube.com', 'youtu.be'],
  // Für diese drei gibt es keinen einen Host: Eine Disc wird bei jedem Händler
  // verkauft, ein Kinostart steht bei jedem Kino, und „unbekannt" ist gerade
  // die Abwesenheit einer Zuordnung. Eine leere Liste heißt „nicht prüfbar".
  disc: [],
  kino: [],
  unbekannt: [],
}

/**
 * Weiterleitungen auflösen, statt sie zu übernehmen.
 *
 * Eine Google-Trefferadresse trägt ihr Ziel im Parameter `url` bei sich. Wer
 * sie unverändert speichert, speichert eine Suchmaschine.
 */
export function entwirreWeiterleitung(url: string): string {
  try {
    const u = new URL(url)
    if (!/(^|\.)google\.[a-z.]+$/i.test(u.hostname)) return url
    const ziel = u.searchParams.get('url') ?? u.searchParams.get('q')
    return ziel && /^https?:\/\//i.test(ziel) ? ziel : url
  } catch {
    return url
  }
}

/**
 * Trägt die Adresse den Anbieter, unter dem sie steht?
 *
 * Kennen wir für einen Anbieter keinen Host, gilt sie als passend — sonst
 * würde eine Lücke in der Tabelle oben stillschweigend gültige Verweise
 * wegwerfen. Falsch durchlassen ist hier billiger als falsch verwerfen.
 */
export function adressePasst(url: string, platform: PlatformId): boolean {
  const hosts = HOSTS[platform]
  if (!hosts?.length) return true
  try {
    const host = new URL(url).hostname.toLowerCase()
    return hosts.some((h) => host === h || host.endsWith('.' + h))
  } catch {
    return false
  }
}

/** Nur damit die Tabelle oben vollständig bleibt, wenn eine Plattform dazukommt. */
export const HOSTS_VOLLSTAENDIG = Object.keys(PLATFORMS).every((p) => p in HOSTS)

/**
 * Zu welchem Anbieter eine Adresse gehört — unabhängig davon, unter welchem
 * Namen sie steht.
 *
 * Der Zweck ist Rettung, nicht Kontrolle: Von 33 Adressen, die am 22.08.2026
 * unter dem falschen Anbieter standen, zeigten alle auf Amazon. Sie wegzuwerfen
 * hätte 33 gültige Kaufwege gekostet; richtig einsortiert sind sie ein Gewinn.
 */
export function plattformAusAdresse(url: string): PlatformId | undefined {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return undefined
  }
  for (const [platform, hosts] of Object.entries(HOSTS) as [PlatformId, string[]][]) {
    if (hosts.some((h) => host === h || host.endsWith('.' + h))) return platform
  }
  return undefined
}
