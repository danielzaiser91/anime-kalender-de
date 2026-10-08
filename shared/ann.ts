/**
 * Adresse eines Encyclopedia-Eintrags bei Anime News Network — Pflicht, wo die Angaben gezeigt werden.
 *
 * Eine Stelle für die Form (Pipeline und Oberfläche); eine zweite Fassung liefe irgendwann auseinander,
 * und dann stünde da ein toter Link unter einer Auflage, die wir erfüllen müssen.
 */
export function annUrl(annId: number): string {
  return `https://www.animenewsnetwork.com/encyclopedia/anime.php?id=${annId}`
}
