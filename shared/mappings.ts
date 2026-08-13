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

/**
 * Adressvorsatz der AniList-Cover — wird in `ohne-synchro.json` **weggelassen**.
 *
 * Die vollen Adressen sind rund 70 Zeichen lang und beginnen alle gleich. Bei
 * achtzehntausend Titeln wären das über ein Megabyte, das jeder überträgt, der
 * den Schalter umlegt — für Information, die in einer Konstanten steht. Der
 * Vorsatz wird deshalb erst beim Laden im Browser wieder angehängt
 * (`loadOhneSynchro`). Der gepflegte Bestand ist davon nicht betroffen: Dort
 * stehen vollständige Adressen, weil die Cover aus mehreren Quellen kommen.
 *
 * **Der Vorsatz endet vor `large/` bzw. `medium/`** — und das ist kein
 * Schönheitsfehler: AniList liefert im Feld `coverImage.large` bei älteren
 * Einträgen tatsächlich eine Adresse mit `/cover/medium/` im Pfad. Ein Vorsatz
 * mit `large/` hätte auf genau diese Titel nicht gepasst und sie ungekürzt
 * gelassen (gemessen 13.08.2026).
 */
export const ANILIST_COVER_BASIS = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/'

/** Genre-Namen (immer englisch im Datensatz) → deutsche Bezeichnung. */
export const GENRE_DE: Record<string, string> = { ...BASE_GENRE_DE, ...TAG_AS_GENRE }

/**
 * Häufige AniList-Tags → deutsche Keywords.
 * Was hier nicht steht, wird unverändert übernommen — die Liste deckt
 * bewusst nur die Tags ab, bei denen die Übersetzung etwas bringt.
 */
/**
 * Formatangaben von AniList in lesbares Deutsch.
 *
 * Sie standen roh im Detail-Panel: „MOVIE", „TV_SHORT", „MUSIC". Fachbegriffe
 * der Szene bleiben, wie sie sind — OVA, ONA und Special sagt auch im
 * Deutschen niemand anders (10.08.2026, aufgefallen beim Test durch einen
 * Bekannten von Daniel).
 */
export const FORMAT_DE: Record<string, string> = {
  TV: 'TV',
  TV_SHORT: 'TV-Kurzformat',
  MOVIE: 'Film',
  SPECIAL: 'Special',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Musikvideo',
}

export const KEYWORD_DE: Record<string, string> = {
  Achromatic: 'Schwarzweiß',
  'Achronological Order': 'Nichtchronologisch erzählt',
  Acrobatics: 'Akrobatik',
  Acting: 'Schauspielerei',
  Advertisement: 'Werbung',
  Afterlife: 'Leben nach dem Tod',
  'Age Gap': 'Altersunterschied',
  'Age Regression': 'Verjüngung',
  Agender: 'Agender',
  Agriculture: 'Landwirtschaft',
  Airsoft: 'Airsoft',
  Alchemy: 'Alchemie',
  Aliens: 'Außerirdische',
  'American Football': 'American Football',
  Amnesia: 'Amnesie',
  'Ancient China': 'Altes China',
  Angels: 'Engel',
  Anthology: 'Anthologie',
  'Arranged Marriage': 'Arrangierte Ehe',
  Assassins: 'Auftragsmörder',
  Astronomy: 'Astronomie',
  Athletics: 'Leichtathletik',
  'Augmented Reality': 'Erweiterte Realität',
  Autobiographical: 'Autobiografisch',
  Aviation: 'Luftfahrt',
  Badminton: 'Badminton',
  Ballet: 'Ballett',
  Bar: 'Bar',
  'Battle Royale': 'Battle Royale',
  Biographical: 'Biografisch',
  Bisexual: 'Bisexuell',
  Blackmail: 'Erpressung',
  'Board Game': 'Brettspiel',
  'Boarding School': 'Internat',
  'Body Image': 'Körperbild',
  'Body Swapping': 'Körpertausch',
  Bowling: 'Bowling',
  Boxing: 'Boxen',
  'Boys\' Love': 'Boys\' Love',
  Bullying: 'Mobbing',
  Butler: 'Butler',
  Calligraphy: 'Kalligrafie',
  Camping: 'Camping',
  Cannibalism: 'Kannibalismus',
  'Card Battle': 'Kartenduell',
  Cars: 'Autos',
  Centaur: 'Zentaur',
  Cheerleading: 'Cheerleading',
  Chibi: 'Chibi',
  Chimera: 'Chimäre',
  Chuunibyou: 'Chuunibyou',
  Circus: 'Zirkus',
  'Class Struggle': 'Klassenkampf',
  'Classic Literature': 'Klassische Literatur',
  'Classical Music': 'Klassische Musik',
  Clone: 'Klon',
  Coastal: 'Küste',
  Cohabitation: 'Zusammenleben',
  Conspiracy: 'Verschwörung',
  'Cosmic Horror': 'Kosmischer Horror',
  Cosplay: 'Cosplay',
  Cowboys: 'Cowboys',
  'Creature Taming': 'Kreaturen zähmen',
  'Criminal Organization': 'Verbrechersyndikat',
  Crossdressing: 'Crossdressing',
  Crossover: 'Crossover',
  Cult: 'Sekte',
  Curses: 'Flüche',
  'Cute Boys Doing Cute Things': 'Süße Jungs im Alltag',
  'Cute Girls Doing Cute Things': 'Süße Mädchen im Alltag',
  Cyborg: 'Cyborg',
  Cycling: 'Radsport',
  Dancing: 'Tanz',
  'Death Game': 'Todesspiel',
  Delinquents: 'Schulschläger',
  Denpa: 'Denpa',
  Desert: 'Wüste',
  Dinosaurs: 'Dinosaurier',
  Disability: 'Behinderung',
  'Dissociative Identities': 'Dissoziative Identität',
  Drawing: 'Zeichnen',
  Drugs: 'Drogen',
  Dullahan: 'Dullahan',
  'E-Sports': 'E-Sport',
  'Eco-Horror': 'Öko-Horror',
  Economics: 'Wirtschaft',
  Educational: 'Lehrreich',
  'Elderly Protagonist': 'Betagter Protagonist',
  Environmental: 'Umwelt',
  'Ero Guro': 'Ero Guro',
  Espionage: 'Spionage',
  'Estranged Family': 'Zerrüttete Familie',
  Exorcism: 'Exorzismus',
  Fairy: 'Fee',
  'Fairy Tale': 'Märchen',
  'Fake Relationship': 'Vorgetäuschte Beziehung',
  'Family Life': 'Familienleben',
  Fashion: 'Mode',
  'Female Harem': 'Frauenharem',
  Femboy: 'Femboy',
  Fencing: 'Fechten',
  Filmmaking: 'Filmemachen',
  Firefighters: 'Feuerwehr',
  Fishing: 'Angeln',
  Fitness: 'Fitness',
  Flash: 'Flash',
  Fugitive: 'Auf der Flucht',
  Gangs: 'Banden',
  'Gender Bending': 'Geschlechtertausch',
  Goblin: 'Goblin',
  Gods: 'Götter',
  Golf: 'Golf',
  Gyaru: 'Gyaru',
  Henshin: 'Henshin',
  Hikikomori: 'Hikikomori',
  'Hip-hop Music': 'Hip-Hop',
  Homeless: 'Obdachlosigkeit',
  Horticulture: 'Gartenbau',
  'Human Experimentation': 'Menschenversuche',
  'Ice Skating': 'Eislaufen',
  'Indigenous Cultures': 'Indigene Kulturen',
  Inn: 'Gasthaus',
  Inseki: 'Inseki',
  Interspecies: 'Zwischen den Arten',
  'Jazz Music': 'Jazz',
  Judo: 'Judo',
  Kaiju: 'Kaiju',
  Karuta: 'Karuta',
  Kemonomimi: 'Kemonomimi',
  'Kingdom Management': 'Königreich verwalten',
  Konbini: 'Konbini',
  Lacrosse: 'Lacrosse',
  'Language Barrier': 'Sprachbarriere',
  'LGBTQ+ Themes': 'LGBTQ+-Themen',
  'Lost Civilization': 'Versunkene Zivilisation',
  Mahjong: 'Mahjong',
  Maids: 'Dienstmädchen',
  Makeup: 'Schminke',
  Marriage: 'Ehe',
  Matchmaking: 'Verkupplung',
  Matriarchy: 'Matriarchat',
  Medicine: 'Medizin',
  'Memory Manipulation': 'Erinnerungsmanipulation',
  Mermaid: 'Meerjungfrau',
  Meta: 'Meta',
  'Metal Music': 'Metal',
  'Mixed Gender Harem': 'Gemischter Harem',
  'Mixed Media': 'Mischformen',
  Modeling: 'Modeln',
  'Monster Boy': 'Monsterjunge',
  'Monster Girl': 'Monstermädchen',
  Mopeds: 'Mopeds',
  Motorcycles: 'Motorräder',
  Mountaineering: 'Bergsteigen',
  'Musical Theater': 'Musiktheater',
  'Natural Disaster': 'Naturkatastrophe',
  Necromancy: 'Nekromantie',
  Nekomimi: 'Nekomimi',
  'No Dialogue': 'Ohne Dialog',
  Noir: 'Noir',
  Nun: 'Nonne',
  Office: 'Büro',
  'Office Lady': 'Büroangestellte',
  Oiran: 'Oiran',
  'Ojou-sama': 'Ojou-sama',
  Orphan: 'Waise',
  'Otaku Culture': 'Otaku-Kultur',
  'Outdoor Activities': 'Draußen unterwegs',
  Pandemic: 'Pandemie',
  Parkour: 'Parkour',
  Photography: 'Fotografie',
  Poker: 'Poker',
  Polyamorous: 'Polyamor',
  POV: 'Ich-Perspektive',
  Pregnancy: 'Schwangerschaft',
  'Primarily Animal Cast': 'Überwiegend tierischer Cast',
  Prison: 'Gefängnis',
  Prophecy: 'Prophezeiung',
  'Proxy Battle': 'Stellvertreterkampf',
  Psychosexual: 'Psychosexuell',
  Puppetry: 'Puppenspiel',
  Rakugo: 'Rakugo',
  'Real Robot': 'Real Robot',
  Rehabilitation: 'Rehabilitation',
  Rescue: 'Rettung',
  Restaurant: 'Restaurant',
  'Reverse Isekai': 'Umgekehrtes Isekai',
  'Rock Music': 'Rock',
  'Royal Affairs': 'Hofintrigen',
  'Scuba Diving': 'Tauchen',
  Shapeshifting: 'Gestaltwandel',
  Ships: 'Schiffe',
  Shogi: 'Shogi',
  'Shrine Maiden': 'Schreinmaid',
  Skateboarding: 'Skateboarding',
  Skeleton: 'Skelett',
  Slapstick: 'Slapstick',
  Slavery: 'Sklaverei',
  'Software Development': 'Softwareentwicklung',
  'Space Opera': 'Space Opera',
  'Stop Motion': 'Stop-Motion',
  Succubus: 'Sukkubus',
  Suicide: 'Suizid',
  Sumo: 'Sumo',
  'Super Robot': 'Super Robot',
  Surfing: 'Surfen',
  'Surreal Comedy': 'Surreale Komik',
  Swimming: 'Schwimmen',
  'Table Tennis': 'Tischtennis',
  Tanks: 'Panzer',
  'Tanned Skin': 'Gebräunte Haut',
  Tennis: 'Tennis',
  Terrorism: 'Terrorismus',
  Tokusatsu: 'Tokusatsu',
  Tomboy: 'Wildfang',
  Torture: 'Folter',
  Trains: 'Züge',
  Transgender: 'Transgender',
  Triads: 'Triaden',
  Twins: 'Zwillinge',
  'Unrequited Love': 'Unerwiderte Liebe',
  Veterinarian: 'Tierarzt',
  Vikings: 'Wikinger',
  'Vocal Synth': 'Vocal Synth',
  VTuber: 'VTuber',
  Werewolf: 'Werwolf',
  Wilderness: 'Wildnis',
  Witch: 'Hexe',
  Work: 'Arbeitswelt',
  Wrestling: 'Wrestling',
  Writing: 'Schreiben',
  Wuxia: 'Wuxia',
  Yakuza: 'Yakuza',
  Youkai: 'Youkai',
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
  // Namen, wie TMDB sie liefert — ausgeschrieben statt als Kürzel. Dieselbe
  // Firma steht dort unter mehreren Schreibweisen („maxdome" und „maxdome
  // Store", „Kixi" und „Kixi Select"); ohne Zusammenführung zeigt das Panel
  // drei Zeilen für einen Anbieter (10.08.2026: 53 Namen, rund 30 Anbieter).
  'apple-tv-store': 'Apple TV',
  'maxdome-store': 'maxdome',
  'akiba-pass-tv': 'Akibapass',
  akibapass: 'Akibapass',
  'kixi-select': 'Kixi',
  'magenta-tv+': 'MagentaTV',
  magentatv: 'MagentaTV',
  'freenet-meinvod': 'freenet meinVOD',
  'google-play-movies': 'Google Play',
  'anime-digital-network': 'ADN',
  'paramount-plus': 'Paramount+',
  'paramount-plus-apple-tv-channel': 'Paramount+ über Apple TV',
  plutotv: 'Pluto TV',
  pokemon: 'Pokémon TV',
  'pokémon': 'Pokémon TV',
  rakuten: 'Rakuten TV',
  arthousecnma: 'Arthouse CNMA',
  'cnma-arthouse': 'Arthouse CNMA',
  iq: 'iQIYI',
  wetv: 'WeTV',
  zdf: 'ZDF',
  'twitter-/-x': 'X',
  filmfriend: 'filmfriend',
  // Abo-Kanäle fremder Anbieter innerhalb von Prime Video. Sie behalten den
  // Namen des eigentlichen Anbieters samt Hinweis, wo er läuft — wer ein
  // Crunchyroll-Abo hat, kommt mit dem Prime-Kanal nicht weiter.
  primevideo: 'Prime Video',
  'primevideo-channel-adn': 'ADN über Prime Video',
  'primevideo-channel-aniverse': 'Aniverse über Prime Video',
  'primevideo-channel-crunchyroll': 'Crunchyroll über Prime Video',
  'primevideo-channel-hbo-max': 'HBO Max über Prime Video',
  'primevideo-channel-kixi-select': 'Kixi über Prime Video',
  'primevideo-channel-moviedome': 'Moviedome über Prime Video',
  'primevideo-channel-pokemon': 'Pokémon TV über Prime Video',
  'primevideo-channel-prosiebenfun': 'ProSieben Fun über Prime Video',
  'primevideo-channel-sevenentertainment': 'Seven Entertainment über Prime Video',
  // Leer heißt: nicht anzeigen. „Default" ist ein Datenfehler von TMDB,
  // „Amazon UK" führt in den britischen Shop.
  youtube: 'YouTube',
  'shahid-vip': 'Shahid VIP',
  default: '',
  'amazon-uk': '',
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
  return (
    provider
      .toLowerCase()
      .replace(/[()]/g, '')
      // Leerzeichen zu Bindestrichen: aniSearch schreibt `primevideo-channel-
      // crunchyroll`, TMDB dieselbe Sache als „Primevideo Channel Crunchyroll".
      // Ohne diese Zeile gibt es zwei Normalformen, und eine Tabelle kann immer
      // nur die eine treffen — der Anbieter stand dann doppelt in der Liste.
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/-(de|deutschland)$/, '')
      .replace(/^-|-$/g, '')
  )
}

export function anisearchPlatform(provider: string): PlatformId | undefined {
  const key = canonicalProvider(provider)
  return ANISEARCH_PLATFORM[key] ?? ANISEARCH_PLATFORM[provider]
}

/**
 * Anzeigename eines Anbieters. **Leer heißt: gar nicht anzeigen.**
 *
 * Zwei Einträge aus TMDB sind für einen deutschen Kalender wertlos: „Default"
 * ist schlicht ein Datenfehler, „Amazon UK" führt in den britischen Shop. Sie
 * stehen mit leerem Wert in der Tabelle; wer diese Funktion benutzt, muss das
 * Ergebnis auf Leere prüfen.
 */
export function providerName(provider: string): string {
  const key = canonicalProvider(provider)
  const treffer = PROVIDER_NAMES[key] ?? PROVIDER_NAMES[provider]
  if (treffer !== undefined) return treffer
  return key.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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
  Record<PlatformId, { de: string; source?: string }>
> = {
  netflix: {
    de: 'Netflix nennt je Titel keine Uhrzeit. Eigenproduktionen erscheinen weltweit um 00:00 Uhr Pacific Time — in Berlin also am frühen Vormittag. Lizenzierte Titel schaltet Netflix um Mitternacht Ortszeit frei.',
    source: 'https://help.netflix.com/en/node/118959',
  },
  disneyplus: {
    de: 'Disney+ veröffentlicht für Deutschland keine feste Uhrzeit.',
  },
  primevideo: {
    de: 'Prime Video macht zur Uhrzeit keine Angabe.',
  },
  aniverse: {
    de: 'aniverse nennt keine Uhrzeit.',
  },
}
