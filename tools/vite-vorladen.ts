/**
 * Das Vorladen der Startdaten im `<head>` (Vite-Plugin `daten-vorladen`, Begründung in `vite.config.ts`).
 *
 * Welche Dateien der Erstaufruf braucht, hängt von der Adresse ab, die erst im Browser feststeht: Die Wochenansicht startet aus
 * `woche.json` (`web/src/lib/start-daten.ts`), jede andere Adresse aus den drei vollen Dateien. Ein kleines Skript im Kopf entscheidet
 * das vor dem ersten Byte des Bündels — dieselbe Regel wie die App (Wochenansicht, kein Titel, keine Suche, Datum und heute in der
 * Woche des Baus) und teilt sie der App als `window.__akWoche` mit — die App holt dann nicht erst `woche.json`, um festzustellen, dass
 * sie nicht reicht. Fehlt die Angabe (Entwicklungsserver), entscheidet die App selbst.
 */
const VOLL = ['meta', 'titles-core', 'releases', 'events']
const WOCHE = ['meta', 'woche']

export function vorladeSkript(opt: { base: string; buildId: string; woche?: { von: string; bis: string } }): string {
  const { base, buildId, woche } = opt
  return `<script>
      (function () {
        var voll = ${JSON.stringify(VOLL)}, teil = ${JSON.stringify(WOCHE)}, nimm = voll;
        try {
          var W = ${JSON.stringify(woche ?? null)};
          var h = location.hash.replace(/^#\\/?/, '').split('?'), q = new URLSearchParams(h[1] || '');
          var heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }), d = q.get('d') || heute;
          if (W && !/\\/t\\/\\d+\\/?$/.test(location.pathname) && ['', 'woche', 'agenda', 'favoriten'].indexOf(h[0]) >= 0 && !q.get('t') && !(q.get('q') || '').trim() && d >= W.von && d <= W.bis && heute >= W.von && heute <= W.bis) nimm = teil;
        } catch (e) {}
        window.__akWoche = nimm === teil;
        nimm.forEach(function (n) {
          var l = document.createElement('link');
          l.rel = 'preload'; l.as = 'fetch'; l.crossOrigin = 'anonymous'; l.href = '${base}data/' + n + '.json?v=${buildId}';
          document.head.appendChild(l);
        });
      })();
    </script>`
}
