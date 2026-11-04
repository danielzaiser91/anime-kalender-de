/**
 * Stand 04.11.2026: die Meldungen mit Termin und deutschem Ton, die der Bau noch keinem Release zuordnet (Artikel | Titel). Die Liste darf nur
 * schrumpfen: ein Eintrag, den `check-meldungen-ohne-release-bestand.ts` als erledigt meldet, wird gestrichen, nie ein neuer angehängt.
 * Bass X Machina und LEGO One Piece sind mit dem Cartoon-Weg (PR 2817) gelöst und fallen nach dem nächsten Bau weg.
 */
export const BEKANNT_OHNE_RELEASE: readonly string[] = [
  'https://www.anime2you.de/news/1065256/prime-video-goblin-slayer-staffel-2-und-mehr/ | Devils‘ Crest',
  'https://www.anime2you.de/news/1065078/aniverse-november-2026-neuzugaenge/ | M.A.S.K.',
  'https://www.anime2you.de/news/1065078/aniverse-november-2026-neuzugaenge/ | Shaman King',
  'https://www.anime2you.de/news/1065078/aniverse-november-2026-neuzugaenge/ | The Most Heretical Last Boss Queen',
  'https://www.anime2you.de/news/1062641/netflix-anime-neu-im-november-2026/ | Bass X Machina',
  'https://www.anime2you.de/news/1062229/netflix-dragon-ball-super-beerus-und-mehr/ | Cyberpunk: Edgerunners II',
  'https://www.anime2you.de/news/1054791/prime-video-attack-on-titan-und-mehr/ | Demon Slayer: Kimetsu no Yaiba – Infinity Castle I',
  'https://www.anime2you.de/news/1052324/netflix-fuenf-herbst-2026-simulcasts/ | STEEL BALL RUN: JoJo’s Bizarre Adventure',
  'https://www.anime2you.de/news/1045399/aniverse-september-2026-neuzugaenge/ | Yandere Dark Elf',
  'https://www.anime2you.de/news/1042851/netflix-anime-neu-im-september-2026/ | LEGO One Piece',
  'https://www.anime2you.de/news/1042851/netflix-anime-neu-im-september-2026/ | Mononoke The Movie: Chapter III – The Curse of the Serpent',
  'https://www.anime2you.de/news/1035882/adn-neuzugaenge-im-august-2026/ | Love & Lies',
  'https://www.anime2you.de/news/1035882/adn-neuzugaenge-im-august-2026/ | Der Held ohne Klasse',
]
