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
  if (platform === 'primevideo') {
    // AniList verlinkt die US-Storefront; die ASIN ist bei Prime Video
    // marktübergreifend dieselbe, deshalb reicht der Domain-Tausch.
    return url
      .replace('primevideo.com/detail', 'primevideo.com/-/de/detail')
      .replace('www.amazon.com/', 'www.amazon.de/')
      .replace('//amazon.com/', '//www.amazon.de/')
  }
  return url
}

/** Amazon-Suchlink als Fallback für Kauf-Releases. */
export function amazonSearchUrl(query: string): string {
  return `https://www.amazon.de/s?k=${encodeURIComponent(`${query} Anime Blu-ray`)}`
}
