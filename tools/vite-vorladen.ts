import { KACHEL_DATEI } from '../shared/wochen-kacheln.ts'
import { datenAdresse } from '../web/src/lib/daten-adresse.ts'

/**
 * Das Vorladen der Startdaten im `<head>` (Vite-Plugin `daten-vorladen`, Begründung in `vite.config.ts`).
 *
 * Welche Dateien der Erstaufruf braucht, hängt von der Adresse ab, die erst im Browser feststeht: Die Wochenansicht startet aus
 * `woche-kacheln.json` (`web/src/lib/start-daten.ts`), jede andere Adresse aus den drei vollen Dateien. Ein kleines Skript im Kopf entscheidet
 * das vor dem ersten Byte des Bündels — dieselbe Regel wie die App (Wochenansicht, kein Titel, keine Suche, Datum und heute in der
 * Woche des Baus) und teilt sie der App als `window.__akWoche` mit — die App holt dann nicht erst `woche-kacheln.json`, um festzustellen, dass
 * sie nicht reicht. Fehlt die Angabe (Entwicklungsserver), entscheidet die App selbst.
 */
const VOLL = ['meta', 'titles-core', 'releases', 'events']
const WOCHE = ['meta', KACHEL_DATEI]

type VorladeOptionen = { base: string; kennungen: Record<string, string>; ersatz: string; woche?: { von: string; bis: string } }

export function vorladeSkript(opt: VorladeOptionen): string {
  const { base, kennungen, ersatz, woche } = opt
  const adressen = Object.fromEntries([...VOLL, ...WOCHE].map((n) => [n, datenAdresse(base, `${n}.json`, kennungen, ersatz)]))
  return `<script>
      (function () {
        var A = ${JSON.stringify(adressen)}, voll = ${JSON.stringify(VOLL)}, teil = ${JSON.stringify(WOCHE)}, nimm = voll;
        try {
          var W = ${JSON.stringify(woche ?? null)};
          var h = location.hash.replace(/^#\\/?/, '').split('?'), q = new URLSearchParams(h[1] || '');
          var heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }), d = q.get('d') || heute;
          if (W && !/\\/t\\/\\d+\\/?$/.test(location.pathname) && ['', 'woche', 'agenda', 'favoriten'].indexOf(h[0]) >= 0 && !q.get('t') && !(q.get('q') || '').trim() && d >= W.von && d <= W.bis && heute >= W.von && heute <= W.bis) nimm = teil;
        } catch (e) {}
        window.__akWoche = nimm === teil;
        nimm.forEach(function (n) {
          var l = document.createElement('link');
          l.rel = 'preload'; l.as = 'fetch'; l.crossOrigin = 'anonymous'; l.href = A[n];
          document.head.appendChild(l);
        });
      })();
    </script>`
}
