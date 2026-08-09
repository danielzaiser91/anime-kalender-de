import type { PlatformId } from './types.ts'

const BASE_GENRE_DE: Record<string, string> = {
  Action: 'Action',
  Adventure: 'Abenteuer',
  Comedy: 'Comedy',
  Drama: 'Drama',
  Ecchi: 'Ecchi',
  Fantasy: 'Fantasy',
  Horror: 'Horror',
  'Mahou Shoujo': 'Magical Girl',
  Mecha: 'Mecha',
  Music: 'Musik',
  Mystery: 'Mystery',
  Psychological: 'Psychologisch',
  Romance: 'Romance',
  'Sci-Fi': 'Sci-Fi',
  'Slice of Life': 'Slice of Life',
  Sports: 'Sport',
  Supernatural: 'Übernatürlich',
  Thriller: 'Thriller',
  Hentai: 'Hentai',
}

/**
 * AniList kennt nur 18 Genres — „Isekai" oder „Crime" liegen dort als Tag vor.
 * Diese Tags werden ab einer gewissen Relevanz wie Genres behandelt, damit der
 * Filter die Begriffe anbietet, nach denen tatsächlich gesucht wird.
 */
export const TAG_AS_GENRE: Record<string, string> = {
  Isekai: 'Isekai',
  Crime: 'Crime',
  Detective: 'Detektiv',
  Military: 'Militär',
  Historical: 'Historisch',
  School: 'Schule',
  Survival: 'Survival',
  Harem: 'Harem',
  'Reverse Harem': 'Reverse Harem',
  'Boys Love': 'Boys Love',
  'Girls Love': 'Girls Love',
  Iyashikei: 'Iyashikei',
  Cyberpunk: 'Cyberpunk',
  Steampunk: 'Steampunk',
  'Post-Apocalyptic': 'Postapokalyptisch',
  Dystopian: 'Dystopie',
  Space: 'Weltraum',
  'Martial Arts': 'Kampfkunst',
  Samurai: 'Samurai',
  Ninja: 'Ninja',
  Pirates: 'Piraten',
  Vampire: 'Vampire',
  Zombie: 'Zombies',
  Demons: 'Dämonen',
  Magic: 'Magie',
  Mythology: 'Mythologie',
  Superhero: 'Superhelden',
  Idol: 'Idols',
  Cooking: 'Kochen',
  Racing: 'Rennsport',
  Gambling: 'Glücksspiel',
  Politics: 'Politik',
  Revenge: 'Rache',
  Gore: 'Gore',
  Parody: 'Parodie',
  Satire: 'Satire',
  Reincarnation: 'Reinkarnation',
  'Time Manipulation': 'Zeitmanipulation',
  'Video Games': 'Videospiele',
  'Slice of Life': 'Slice of Life',
  Villainess: 'Villainess',
  Cultivation: 'Kultivierung',
  Josei: 'Josei',
  Seinen: 'Seinen',
  Shoujo: 'Shoujo',
  Shounen: 'Shounen',
  Kids: 'Kinder',
}

/** Ab dieser Relevanz gilt ein Tag als prägend genug für den Genre-Filter. */
export const TAG_AS_GENRE_MIN_RANK = 60

/** Genre-Namen (immer englisch im Datensatz) → deutsche Bezeichnung. */
export const GENRE_DE: Record<string, string> = { ...BASE_GENRE_DE, ...TAG_AS_GENRE }

/**
 * Häufige AniList-Tags → deutsche Keywords.
 * Was hier nicht steht, wird unverändert übernommen — die Liste deckt
 * bewusst nur die Tags ab, bei denen die Übersetzung etwas bringt.
 */
export const KEYWORD_DE: Record<string, string> = {
  'Male Protagonist': 'Männlicher Protagonist',
  'Female Protagonist': 'Weibliche Protagonistin',
  'Ensemble Cast': 'Ensemble-Cast',
  'Primarily Female Cast': 'Überwiegend weiblicher Cast',
  'Primarily Male Cast': 'Überwiegend männlicher Cast',
  'Primarily Adult Cast': 'Überwiegend erwachsener Cast',
  'Primarily Child Cast': 'Überwiegend kindlicher Cast',
  'Primarily Teen Cast': 'Überwiegend jugendlicher Cast',
  Isekai: 'Isekai',
  Reincarnation: 'Reinkarnation',
  'Time Skip': 'Zeitsprung',
  'Time Manipulation': 'Zeitmanipulation',
  'Time Loop': 'Zeitschleife',
  Magic: 'Magie',
  Swordplay: 'Schwertkampf',
  Spearplay: 'Speerkampf',
  Archery: 'Bogenschießen',
  'Martial Arts': 'Kampfkunst',
  Guns: 'Schusswaffen',
  War: 'Krieg',
  Military: 'Militär',
  Politics: 'Politik',
  Revenge: 'Rache',
  Survival: 'Survival',
  Tragedy: 'Tragödie',
  Philosophy: 'Philosophie',
  Religion: 'Religion',
  Demons: 'Dämonen',
  Dragons: 'Drachen',
  Elf: 'Elfen',
  Vampire: 'Vampire',
  Zombie: 'Zombies',
  Ghost: 'Geister',
  Robots: 'Roboter',
  'Artificial Intelligence': 'Künstliche Intelligenz',
  Space: 'Weltraum',
  'Post-Apocalyptic': 'Postapokalyptisch',
  Dystopian: 'Dystopie',
  Historical: 'Historisch',
  Medieval: 'Mittelalter',
  Samurai: 'Samurai',
  Ninja: 'Ninja',
  Pirates: 'Piraten',
  Detective: 'Detektiv',
  Crime: 'Verbrechen',
  Mafia: 'Mafia',
  'Police': 'Polizei',
  School: 'Schule',
  'School Club': 'Schulclub',
  Teacher: 'Lehrer',
  College: 'Universität',
  Workplace: 'Arbeitswelt',
  Cooking: 'Kochen',
  Food: 'Essen',
  Music: 'Musik',
  Idol: 'Idols',
  Band: 'Band',
  Sports: 'Sport',
  Baseball: 'Baseball',
  Basketball: 'Basketball',
  Football: 'Fußball',
  Volleyball: 'Volleyball',
  Racing: 'Rennsport',
  'Video Games': 'Videospiele',
  'Virtual World': 'Virtuelle Welt',
  MMORPG: 'MMORPG',
  Dungeon: 'Dungeon',
  'Video Game Adaptation': 'Videospiel-Adaption',
  Cultivation: 'Kultivierung',
  'Super Power': 'Superkräfte',
  Superhero: 'Superhelden',
  'Coming of Age': 'Erwachsenwerden',
  'Love Triangle': 'Dreiecksbeziehung',
  Harem: 'Harem',
  'Reverse Harem': 'Reverse Harem',
  'Boys Love': 'Boys Love',
  'Girls Love': 'Girls Love',
  Yuri: 'Yuri',
  Yaoi: 'Yaoi',
  Josei: 'Josei',
  Seinen: 'Seinen',
  Shoujo: 'Shoujo',
  Shounen: 'Shounen',
  Kids: 'Kinder',
  Iyashikei: 'Iyashikei',
  'Slice of Life': 'Slice of Life',
  'Found Family': 'Gefundene Familie',
  Family: 'Familie',
  Parenthood: 'Elternschaft',
  Adoption: 'Adoption',
  Animals: 'Tiere',
  Anthropomorphism: 'Anthropomorph',
  Cute: 'Niedlich',
  Gore: 'Gore',
  Violence: 'Gewalt',
  'Body Horror': 'Body Horror',
  Psychological: 'Psychologisch',
  Tsundere: 'Tsundere',
  Kuudere: 'Kuudere',
  Yandere: 'Yandere',
  Dandere: 'Dandere',
  'Anti-Hero': 'Antiheld',
  Villainess: 'Villainess',
  Nobility: 'Adel',
  Royalty: 'Königshaus',
  Merchant: 'Handel',
  Travel: 'Reisen',
  Rural: 'Ländlich',
  Urban: 'Urban',
  Snowscape: 'Schneelandschaft',
  Episodic: 'Episodisch',
  CGI: 'CGI',
  Rotoscoping: 'Rotoskopie',
  'Full CGI': 'Voll-CGI',
  Anachronism: 'Anachronismus',
  Steampunk: 'Steampunk',
  Cyberpunk: 'Cyberpunk',
  Mythology: 'Mythologie',
  'Urban Fantasy': 'Urban Fantasy',
  'Alternate Universe': 'Alternatives Universum',
  Heterosexual: 'Heterosexuell',
  Asexual: 'Asexuell',
  Aromantic: 'Aromantisch',
  Foreign: 'Ausland',
}

/**
 * Tags, die im Frontend nichts verloren haben — entweder Meta-Information
 * über die Produktion oder Erwachsenen-Kategorien.
 */
export const KEYWORD_BLOCKLIST = new Set([
  'Nudity', 'Sex', 'Sexual Abuse', 'Boobs', 'Anal Sex', 'Oral Sex', 'Bondage',
  'Rape', 'Incest', 'Lolicon', 'Shotacon', 'Tentacles', 'Prostitution',
  'Public Sex', 'Threesome', 'Netorare', 'Ahegao', 'Femdom', 'Futanari',
  'Male Harem', 'Fetish',
])

/** AniList-Linkziele → interne Plattform-ID (nur für Deutschland relevante). */
export function platformFromSite(site: string): PlatformId | undefined {
  const s = site.toLowerCase()
  if (s.includes('crunchyroll')) return 'crunchyroll'
  if (s.includes('netflix')) return 'netflix'
  if (s.includes('amazon') || s.includes('prime video')) return 'primevideo'
  if (s.includes('disney')) return 'disneyplus'
  if (s.includes('animation digital network') || s === 'adn') return 'adn'
  if (s.includes('youtube')) return 'youtube'
  return undefined
}

/** Reihenfolge, in der Plattformen als „Haupt-Plattform" gewählt werden. */
export const PLATFORM_PRIORITY: PlatformId[] = [
  'crunchyroll',
  'netflix',
  'disneyplus',
  'primevideo',
  'adn',
  'aniverse',
  'wow',
  'joyn',
  'rtlplus',
  'youtube',
  'disc',
  'kino',
]

/** Macht aus einer globalen Streaming-URL die deutsche Variante. */
export function germanizeUrl(platform: PlatformId, url: string): string {
  if (platform === 'crunchyroll') {
    return url.replace(/crunchyroll\.com\/(?!de\/)/, 'crunchyroll.com/de/')
  }
  if (platform === 'disneyplus') {
    return url.replace(/disneyplus\.com\/(?!de-de\/)/, 'disneyplus.com/de-de/')
  }
  return url
}

/** Amazon-Suchlink als Fallback für Kauf-Releases. */
export function amazonSearchUrl(query: string): string {
  return `https://www.amazon.de/s?k=${encodeURIComponent(`${query} Anime Blu-ray`)}`
}

/**
 * Prime-Video-Links laufen bei uns grundsätzlich über **amazon.de**.
 *
 * Zwei Gründe. Erstens: Die ASIN ist **nicht** marktübergreifend gleich —
 * `amazon.com/dp/B0H1QXXRG1` auf `amazon.de` umzuschreiben führt zuverlässig
 * auf eine Fehlerseite (am 08.08.2026 genau so passiert). AniList verlinkt fast
 * immer die US-Storefront, ihre Kennungen sind hier also wertlos.
 * Zweitens: `amazon.de` ist die vertrautere Adresse als `primevideo.com` und
 * führt zur selben Inhalteseite.
 *
 * Ein brauchbarer Deeplink kann deshalb nur aus der Kuratierung kommen; alles
 * andere wird zur Suche.
 */
export function isUnusablePrimeLink(url: string): boolean {
  return !/^https:\/\/(www\.)?amazon\.de\//.test(url)
}

/** Suche auf amazon.de statt eines Deeplinks, der ins Leere führt. */
export function primeVideoSearchUrl(query: string): string {
  return `https://www.amazon.de/s?k=${encodeURIComponent(query)}&i=instant-video`
}

/**
 * Suchadressen der Streamingdienste — der Rettungsanker, wenn AniList keinen
 * Deeplink kennt.
 *
 * Gerade bei Katalogtiteln ist das die Regel: AniList pflegt Anbieter-Links
 * vor allem für neue Simulcasts, ein 2000er-Jahrgang wie „Yu-Gi-Oh!" hat dort
 * keinen. Ohne Fallback stünde die Plattform als toter Text da, obwohl der
 * Titel dort nachweislich läuft. Eine Suche mit dem richtigen Begriff führt in
 * zwei Klicks ans Ziel — und sie kann nicht veralten.
 */
const PLATFORM_SEARCH: Partial<Record<PlatformId, (q: string) => string>> = {
  netflix: (q) => `https://www.netflix.com/search?q=${encodeURIComponent(q)}`,
  disneyplus: (q) => `https://www.disneyplus.com/de-de/search?q=${encodeURIComponent(q)}`,
  crunchyroll: (q) => `https://www.crunchyroll.com/de/search?q=${encodeURIComponent(q)}`,
  primevideo: primeVideoSearchUrl,
  adn: (q) => `https://animationdigitalnetwork.com/de/search?q=${encodeURIComponent(q)}`,
  wow: (q) => `https://www.wowtv.de/suche?q=${encodeURIComponent(q)}`,
  joyn: (q) => `https://www.joyn.de/suche?search=${encodeURIComponent(q)}`,
  rtlplus: (q) => `https://plus.rtl.de/suche?q=${encodeURIComponent(q)}`,
  youtube: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
  aniverse: (q) => `https://www.aniverse.de/?s=${encodeURIComponent(q)}`,
  disc: amazonSearchUrl,
}

/**
 * Notfall-Adresse für eine Plattform. `undefined` für `kino` — ein Kinostart
 * hat keine eine Adresse, an die man schicken könnte, und eine erfundene wäre
 * schlechter als gar keine.
 */
export function platformSearchUrl(platform: PlatformId, query: string): string | undefined {
  return PLATFORM_SEARCH[platform]?.(query)
}

/**
 * aniSearch-Anbieterkürzel → unsere Plattform, soweit es eine gibt.
 *
 * Nur die großen Dienste haben bei uns eine eigene Plattform mit Farbe und
 * Filter. Alles andere wandert als schlichter Verweis in `watchLinks` — das
 * ist kein Mangel, sondern die ehrliche Abbildung: Maxdome und Videobuster
 * gehören nicht in einen Filter „Plattform", aber sehr wohl in die Antwort auf
 * „wo kann ich das sehen".
 */
const ANISEARCH_PLATFORM: Record<string, PlatformId> = {
  crunchyroll: 'crunchyroll',
  netflix: 'netflix',
  disneyplus: 'disneyplus',
  'disney-plus': 'disneyplus',
  wow: 'wow',
  joyn: 'joyn',
  'rtl-plus': 'rtlplus',
  rtlplus: 'rtlplus',
  'rtl+': 'rtlplus',
  youtube: 'youtube',
  adn: 'adn',
  'animation-digital-network': 'adn',
  aniverse: 'aniverse',
}

/** Anbieter, bei denen man kauft oder leiht statt im Abo zu schauen. */
const BUY_PROVIDERS = new Set([
  'amazon',
  'maxdome',
  'sky-store',
  'videobuster',
  'itunes',
  'apple-tv',
  'google-play',
  'microsoft-store',
  'rakuten-tv',
  'videoload',
])

/** Anzeigenamen für die Kürzel — „sky-store-de" will niemand lesen. */
const PROVIDER_NAMES: Record<string, string> = {
  amazon: 'Amazon',
  maxdome: 'maxdome',
  'sky-store': 'Sky Store',
  videobuster: 'Videobuster',
  itunes: 'iTunes',
  'apple-tv': 'Apple TV',
  'google-play': 'Google Play',
  'microsoft-store': 'Microsoft Store',
  'rakuten-tv': 'Rakuten TV',
  videoload: 'Videoload',
  toggo: 'TOGGO',
  'anime-on-demand': 'Anime on Demand',
  akiba: 'Akiba Pass TV',
}

/**
 * Vereinheitlicht die Anbieterkennung.
 *
 * aniSearch schreibt denselben Dienst je nach Kachel als `amazon-de`,
 * `amazon-(de)` oder `amazon`. Ohne diese Angleichung stünde derselbe Anbieter
 * mehrfach in der Liste, einmal als Kauf und einmal als Stream.
 */
export function canonicalProvider(provider: string): string {
  return provider
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/-+/g, '-')
    .replace(/-(de|deutschland)$/, '')
    .replace(/^-|-$/g, '')
}

export function anisearchPlatform(provider: string): PlatformId | undefined {
  const key = canonicalProvider(provider)
  return ANISEARCH_PLATFORM[key] ?? ANISEARCH_PLATFORM[provider]
}

export function providerName(provider: string): string {
  const key = canonicalProvider(provider)
  return (
    PROVIDER_NAMES[key] ??
    PROVIDER_NAMES[provider] ??
    key.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

export function providerKind(provider: string): 'stream' | 'buy' {
  return BUY_PROVIDERS.has(canonicalProvider(provider)) || BUY_PROVIDERS.has(provider) ? 'buy' : 'stream'
}

/**
 * Entfernt fremde Partner-Kennungen aus einer Adresse.
 *
 * aniSearch hängt an seine Amazon-Links ein `?tag=anisearch.de`. Diesen Link
 * unverändert weiterzureichen hieße, deren Provision über unsere Seite laufen
 * zu lassen — eine stille Entscheidung, die niemand getroffen hat. Dieses
 * Projekt ist ausdrücklich unkommerziell; also fliegt der Anhang raus.
 */
export function stripAffiliate(url: string): string {
  try {
    const parsed = new URL(url)
    for (const key of ['tag', 'ascsubtag', 'linkCode', 'ref_', 'affiliate', 'utm_source', 'utm_medium']) {
      parsed.searchParams.delete(key)
    }
    return parsed.toString().replace(/\?$/, '')
  } catch {
    return url
  }
}

/**
 * Warum bei dieser Plattform keine Uhrzeit steht.
 *
 * „Zeit offen" ist ehrlich, aber unbefriedigend — der Leser weiß nicht, ob wir
 * schlampig gepflegt haben oder ob es die Angabe schlicht nicht gibt. Meist
 * ist Letzteres der Fall, und das lässt sich sagen.
 *
 * Nur Netflix macht dazu eine belastbare Aussage, und die steht in ihrer
 * eigenen Hilfe. Für Disney+ und Prime Video gibt es keine — hier steht
 * deshalb genau das und keine Faustregel aus dem Internet. Eine plausible
 * Uhrzeit als `time` einzutragen wäre der bequemere Weg und genau die Art
 * Falschangabe, die dieses Projekt vermeiden will.
 */
export const PLATFORM_TIME_NOTE: Partial<
  Record<PlatformId, { de: string; en: string; source?: string }>
> = {
  netflix: {
    de: 'Netflix nennt je Titel keine Uhrzeit. Eigenproduktionen erscheinen weltweit um 00:00 Uhr Pacific Time — in Berlin also am frühen Vormittag. Lizenzierte Titel schaltet Netflix um Mitternacht Ortszeit frei.',
    en: 'Netflix gives no per-title time. Its own productions go live worldwide at 12:00 a.m. Pacific Time — late morning in Berlin. Licensed titles unlock at midnight local time.',
    source: 'https://help.netflix.com/en/node/118959',
  },
  disneyplus: {
    de: 'Disney+ veröffentlicht für Deutschland keine feste Uhrzeit.',
    en: 'Disney+ publishes no fixed release time for Germany.',
  },
  primevideo: {
    de: 'Prime Video macht zur Uhrzeit keine Angabe.',
    en: 'Prime Video does not state a release time.',
  },
  aniverse: {
    de: 'aniverse nennt keine Uhrzeit.',
    en: 'aniverse does not state a release time.',
  },
}
