export const CONTACT_EMAIL = 'danielzaiser91@googlemail.com'

export function DatenschutzView() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Datenschutzerklärung</h1>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Verantwortlicher</h2>
        <p>
          Daniel Zaiser,{' '}
          <a className="underline hover:text-sky-400" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Aufruf der Seite</h2>
        <p>
          Diese Seite ist statisch. Sie setzt keine Cookies, kein Tracking, keine Analyse-Werkzeuge und
          keine Werbenetzwerke ein. Beim Abruf verarbeitet der Hoster GitHub Pages (GitHub Inc., 88
          Colin P Kelly Jr Street, San Francisco, CA 94107, USA) technisch notwendige Server-Logdaten
          wie IP-Adresse, Zeitpunkt und aufgerufene Datei. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f
          DSGVO (berechtigtes Interesse am sicheren Betrieb). Die Übermittlung in die USA stützt sich
          auf die Standardvertragsklauseln, die GitHub in seinen{' '}
          <a className="underline" href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement">
            Datenschutzbestimmungen
          </a>{' '}
          zusichert.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Bilder von Drittanbietern</h2>
        <p>
          Cover- und Bannerbilder werden direkt von den Servern von AniList (AniList, Delaware, USA)
          geladen. Dabei wird deine IP-Adresse dorthin übertragen — technisch unvermeidbar, wenn ein
          Bild von einem fremden Server angezeigt wird. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Öffnest du ein Cover in der Vergrößerung, lädt die Seite zusätzlich ein größeres Plakat vom Bildserver von TMDB (The Movie Database); auch dabei wird deine IP-Adresse dorthin übertragen. Ohne diese Handlung wird nichts von TMDB geladen.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Lokale Speicherung im Browser</h2>
        <p>
          Sprachwahl, Farbschema und deine Favoriten werden im <em>localStorage</em> deines Browsers
          abgelegt. Diese Daten verlassen dein Gerät nicht und werden von uns weder gelesen noch
          übertragen. Löschen kannst du sie jederzeit über die Browsereinstellungen.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Newsletter</h2>
        <p>
          Für den Newsletter speichern wir E-Mail-Adresse, gewählten Rhythmus, Plattformauswahl sowie
          Zeitpunkt und IP-Adresse von Anmeldung und Bestätigung. Letzteres dient allein dem Nachweis
          der Einwilligung. Rechtsgrundlage ist Art. 6 Abs. 1 lit. a DSGVO. Die Anmeldung erfolgt im
          Double-Opt-in-Verfahren: Ohne Klick auf den Bestätigungslink wird kein Abo aktiv.
        </p>
        <p className="mt-2">
          Die Daten liegen in einer Cloudflare-D1-Datenbank (Cloudflare Germany GmbH bzw. Cloudflare,
          Inc.); der Versand erfolgt über einen E-Mail-Dienstleister. Mit beiden bestehen Verträge zur
          Auftragsverarbeitung nach Art. 28 DSGVO. Ein Widerruf ist jederzeit über den Abmeldelink in
          jeder Mail möglich; der Datensatz wird dabei vollständig gelöscht.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">
          Keine Erfolgsmessung im Newsletter
        </h2>
        <p>
          Der Versand läuft über die eigene Absenderdomain{' '}
          <code>send.anime-kalender.de</code>. Öffnungs- und Klick-Erfassung sind dort abgeschaltet:
          Die Mails enthalten kein Zählpixel, und die Links führen direkt zum Ziel statt über einen
          Zählserver. Wir erfahren also nicht, ob und wann du eine Mail geöffnet oder worauf du
          geklickt hast.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Speicherdauer</h2>
        <p>
          Newsletter-Daten werden gespeichert, bis du dich abmeldest. Server-Logdaten des Hosters
          werden nach dessen Vorgaben gelöscht.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Deine Rechte</h2>
        <p>
          Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
          Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch
          (Art. 21 DSGVO) sowie das Recht, eine erteilte Einwilligung jederzeit zu widerrufen. Wende
          dich dafür an die oben genannte E-Mail-Adresse.
        </p>
        <p className="mt-2">
          Außerdem steht dir ein Beschwerderecht bei einer Aufsichtsbehörde zu, etwa dem Landesbeauftragten
          für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz.
        </p>
      </div>
    </div>
  )
}
