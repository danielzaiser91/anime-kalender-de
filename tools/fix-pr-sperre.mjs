/**
 * Welche offenen PRs des Fixers den nächsten Fix sperren und unter der Wache-Zeile stehen: eine Menge für beide
 * (Workflow `claude-reparatur.yml` ruft die Datei per CLI, `fix-pr-hinweis.mjs` als Modul). Nur Node-Bordmittel: der Workflow lädt sie ohne `npm ci`.
 */
import { pathToFileURL } from 'node:url'

export const FIXER_AUTOR = 'app/claude'
// Der Fixer legt auch wache/-PRs an (2605).
export const FIX_ZWEIG_PRAEFIXE = ['fix/', 'wache/']
// Ein liegengebliebener PR darf den Fixer nicht dauerhaft sperren.
export const SPERR_STUNDEN = 6

/** Offene PRs des Fixers (`fix/`, `wache/`), jünger als `SPERR_STUNDEN`. */
export function sperrendeFixPrs(prs, jetztMs) {
  return prs.filter(
    (p) =>
      p.author?.login === FIXER_AUTOR &&
      FIX_ZWEIG_PRAEFIXE.some((z) => p.headRefName.startsWith(z)) &&
      jetztMs - Date.parse(p.createdAt) < SPERR_STUNDEN * 3_600_000,
  )
}

// CLI: JSON von `gh pr list --json number,headRefName,createdAt,author` auf stdin, Ausgabe „1,2“. Jetzt-Zeit überschreibbar für Tests.
async function main() {
  let text = ''
  for await (const stueck of process.stdin) text += stueck
  const jetzt = process.env.SPERRE_JETZT_MS ? Number(process.env.SPERRE_JETZT_MS) : Date.now()
  console.log(sperrendeFixPrs(JSON.parse(text), jetzt).map((p) => p.number).join(','))
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()
