import type { ReactNode } from 'react'

export const CONTACT_EMAIL = 'danielzaiser91@googlemail.com'

function Abschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="font-semibold text-slate-800 dark:text-slate-100">{titel}</h2>
      {children}
    </div>
  )
}

/** Was die Seite im Browser selbst tut: Aufruf, Bilder, Speicher, fremde Hosts. */
function BrowserAbschnitte() {
  return (
    <>
      <Abschnitt titel="Verantwortlicher">
        <p>
          Daniel Zaiser,{' '}
          <a className="underline hover:text-sky-400" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </Abschnitt>

      <Abschnitt titel="Aufruf der Seite">
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
      </Abschnitt>

      <Abschnitt titel="Bilder und Inhalte von Drittanbietern">
        <p>
          Cover- und Bannerbilder werden direkt von den Servern von AniList (AniList, Delaware, USA)
          geladen. Dabei wird deine IP-Adresse dorthin übertragen — technisch unvermeidbar, wenn ein
          Bild von einem fremden Server angezeigt wird. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.
          Fährst du im Detail-Panel über das Cover oder tippst es an, baut dein Browser eine Verbindung
          zum Bildserver von TMDB (The Movie Database) auf; öffnest du die Vergrößerung, lädt die Seite
          von dort ein größeres Plakat. Auch dabei wird deine IP-Adresse übertragen. Ohne diese
          Handlung wird nichts von TMDB geladen.
        </p>
        <p className="mt-2">
          Spielst du einen Trailer ab, lädt die Seite erst dann den Player von YouTube
          (youtube-nocookie.com, Google); dorthin wird deine IP-Adresse übertragen. Importierst du
          deine AniList-Liste, fragt dein Browser AniList direkt nach deinem Benutzernamen; zu uns
          gelangt davon nichts.
        </p>
      </Abschnitt>

      <Abschnitt titel="Lokale Speicherung im Browser">
        <p>
          Sprachwahl, Farbschema und deine Favoriten werden im <em>localStorage</em> deines Browsers
          abgelegt. Sie bleiben auf deinem Gerät; nur wenn du den Newsletter oder
          Browser-Benachrichtigungen einschaltest, gehen die Favoriten an unseren Dienst (siehe unten).
          Löschen kannst du sie jederzeit über die Browsereinstellungen.
        </p>
      </Abschnitt>
    </>
  )
}

/** Was an unseren Dienst geht: Newsletter, Favoriten-Abgleich, Push. */
function DienstAbschnitte() {
  return (
    <>
      <Abschnitt titel="Newsletter">
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
        <p className="mt-2">
          Mit dem Newsletter wird auch deine Favoritenliste (AniList-Kennungen) gespeichert und bei
          jeder Änderung abgeglichen; im Browser liegen dafür ein Abgleich-Schlüssel und deine
          Adresse. Der persönliche Kalender-Feed und die Wiederherstellung per Mail nutzen
          denselben Bestand.
        </p>
      </Abschnitt>

      <Abschnitt titel="Browser-Benachrichtigungen">
        <p>
          Schaltest du sie ein, bestätigst du zuerst die Browserabfrage. Dann speichert unser Dienst
          (Cloudflare) die Push-Adresse deines Browsers und deine Favoriten und schickt dir eine
          Nachricht, wenn eine gemerkte Folge erscheint. Sie wird über den Push-Dienst deines
          Browserherstellers (etwa Google, Mozilla, Apple oder Microsoft) zugestellt. Rechtsgrundlage
          ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Ausschalten löscht den Eintrag bei uns.
        </p>
      </Abschnitt>

      <Abschnitt titel="Keine Erfolgsmessung im Newsletter">
        <p>
          Der Versand läuft über die eigene Absenderdomain <code>send.anime-kalender.de</code>.
          Öffnungs- und Klick-Erfassung sind dort abgeschaltet: Die Mails enthalten kein Zählpixel, und
          die Links führen direkt zum Ziel statt über einen Zählserver. Wir erfahren also nicht, ob und
          wann du eine Mail geöffnet oder worauf du geklickt hast.
        </p>
      </Abschnitt>

      <Abschnitt titel="Speicherdauer">
        <p>
          Newsletter-Daten werden gespeichert, bis du dich abmeldest, Push-Daten, bis du die
          Benachrichtigungen ausschaltest. Server-Logdaten des Hosters werden nach dessen Vorgaben
          gelöscht.
        </p>
      </Abschnitt>

      <Abschnitt titel="Deine Rechte">
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
      </Abschnitt>
    </>
  )
}

export function DatenschutzView() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Datenschutzerklärung</h1>
      <BrowserAbschnitte />
      <DienstAbschnitte />
    </div>
  )
}
