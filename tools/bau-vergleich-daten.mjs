/**
 * Handdateien unter `data/` (ohne `data/cache/`, das liegt nicht im Repo) für `bau-vergleich.mjs`:
 * Der Kandidat baut auf dem Stand der Basis plus seinen eigenen Änderungen seit der Merge-Basis.
 * Das ganze `data/` des Kandidaten zu nehmen, hieße bei einem Kandidaten hinter der Basis, die
 * Sammler-Rohdaten von `main` als Unterschied zu melden.
 */

/** Änderungen des Kandidaten seit der Merge-Basis unter `data/`: `[{ status: 'A'|'M'|'D', pfad }]`. */
function eigeneAenderungen(git, basis, kandidat) {
  return git('-c', 'core.quotepath=off', 'diff', '--name-status', '--no-renames', `${basis}...${kandidat}`, '--', 'data')
    .split('\n')
    .filter(Boolean)
    .map((zeile) => {
      const [status, pfad] = zeile.split('\t')
      return { status, pfad }
    })
}

/** Ruft `lauf` mit den Pfaden in Blöcken auf (Befehlszeilenlänge unter Windows). */
function inBloecken(pfade, lauf) {
  for (let i = 0; i < pfade.length; i += 200) lauf(pfade.slice(i, i + 200))
}

/**
 * Bringt den Baum von `sha` auf `public/data` und `data/` der Basis und übernimmt davon abweichend nur die
 * eigenen Änderungen des Kandidaten (neu/geändert aus `sha`, gelöschte entfernt). Gibt die Änderungen zurück.
 */
export function setzeDatenstand(git, imBaum, basisSha, sha) {
  imBaum('rm', '-rfq', '--ignore-unmatch', 'data')
  imBaum('checkout', basisSha, '--', 'public/data', 'data')
  const eigene = sha === basisSha ? [] : eigeneAenderungen(git, basisSha, sha)
  const geloescht = eigene.filter((e) => e.status === 'D').map((e) => e.pfad)
  const uebernommen = eigene.filter((e) => e.status !== 'D').map((e) => e.pfad)
  inBloecken(uebernommen, (p) => imBaum('checkout', sha, '--', ...p))
  inBloecken(geloescht, (p) => imBaum('rm', '-fq', '--ignore-unmatch', '--', ...p))
  return eigene
}

/** Kürzt eine Dateiliste für die Ausgabe. */
const nenne = (dateien) => dateien.slice(0, 5).join(', ') + (dateien.length > 5 ? `, … (+${dateien.length - 5})` : '')

/** Hinweis für die Ausgabe „gleich“: Der Kandidat ändert Handdateien, ohne dass der Bau etwas anderes schreibt. */
export function gleichTrotzDatenHinweis(git, basis, kandidat) {
  const eigene = eigeneAenderungen(git, basis, kandidat).map((e) => e.pfad)
  if (!eigene.length) return []
  return [`Hinweis: Der Kandidat ändert ${eigene.length} Dateien unter data/ (${nenne(eigene)}); mitgebaut, der Bau schreibt trotzdem dasselbe.`]
}
