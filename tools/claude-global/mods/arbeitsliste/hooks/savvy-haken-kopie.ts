import type { On } from 'claude-code'

// Kopie der Verdrahtung, die die fremde Mod claude-kit/savvy-progress (~/.claude/mods/claude-kit/plugins/savvy-progress/hooks/register.tsx,
// nicht im Repo) auf den Knopfzähler der Mod „arbeitsliste“ hat: `next(e)`, danach `togglePane($)`. Im Test darf ein Hook kein `$.ui.*`
// rufen (Host-Regel), darum schaltet `schalte` das Fake-Pane. tools/claude-global/savvy-haken.mjs meldet bei
// `einrichten.mjs --pruefen`, wenn dieser Hook in der installierten Datei fehlt (z. B. nach einem claude-kit-Update).
export function haengeAgentenKnopfHaken(on: On, schalte: () => void): void {
  on('state.set', { plugin: 'arbeitsliste', key: 'agentenKnopf' } as never, async (_$, e, next) => {
    const result = await next(e)
    schalte()
    return result
  })
}
