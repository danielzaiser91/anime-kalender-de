/** Pfad der Teilen-Seite eines Titels: Der Knopf (Web) und der Seitenbau (Pipeline) nennen dieselbe Adresse. */
export function teilenPfad(slug: string | number): string {
  return `t/${slug}/`
}
