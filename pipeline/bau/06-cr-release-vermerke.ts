import { ergaenzeCrSimuldubs } from './06-cr-simuldubs.ts'
import { ergaenzeVerpasstAnReleases } from './verpasst-am-termin.ts'
import { verpassteTermine } from './grundlagen.ts'

/** Phase 06 samt Ausfall-Vermerken: auch die automatisch ergänzten Crunchyroll-Releases tragen `schedule.verpasst`. */
export function ergaenzeCrReleases(args: Parameters<typeof ergaenzeCrSimuldubs>[0]): void {
  ergaenzeCrSimuldubs(args)
  ergaenzeVerpasstAnReleases(args.releases, verpassteTermine)
}
