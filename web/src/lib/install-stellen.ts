/**
 * Wo das Install-Angebot steht — genau eine Stelle oder keine (Daniel, 09.10.2026).
 * Draußen, wenn Platz ist (Kopf-Knopf 390–767 px und ab 1280 px, nur wenn der Browser die Installation anbietet),
 * sonst im Glocken-Menü. Reine Funktion, damit `check-install-stellen.ts` die Tabelle prüft.
 *
 * | Handy | installiert | canPrompt | iOS | ≥ 390 px | Kopf | Menü                        |
 * |-------|-------------|-----------|-----|----------|------|-----------------------------|
 * | nein  | –           | –         | –   | –        | nein | –                           |
 * | ja    | ja          | –         | –   | –        | nein | –                           |
 * | ja    | nein        | ja        | –   | ja       | ja   | –                           |
 * | ja    | nein        | ja        | –   | nein     | nein | direkt (Knopf)              |
 * | ja    | nein        | nein      | ja  | –        | nein | ios (Anleitung)             |
 * | ja    | nein        | nein      | nein| –        | nein | hinweis (Browser-Menü)      |
 */
export const KOPF_KNOPF_AB_PX = 390
/** Von 768 bis 1279 px fehlt im Kopf der Platz (Zahnrad, Navigation): der Knopf wandert ins Menü. */
export const KOPF_KNOPF_BIS_PX = 767
export const KOPF_KNOPF_AB_BREIT_PX = 1280

export interface InstallLage {
  handheld: boolean
  installed: boolean
  canPrompt: boolean
  ios: boolean
  breit: boolean
}

export type MenueInstall = 'direkt' | 'ios' | 'hinweis' | null

export function installStellen(l: InstallLage): { kopf: boolean; menue: MenueInstall } {
  if (!l.handheld || l.installed) return { kopf: false, menue: null }
  if (l.canPrompt) return l.breit ? { kopf: true, menue: null } : { kopf: false, menue: 'direkt' }
  return { kopf: false, menue: l.ios ? 'ios' : 'hinweis' }
}
