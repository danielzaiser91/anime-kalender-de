# Newsletter-Dienst

## Wo das läuft (die wichtigste Klarstellung)

**Nichts davon läuft auf deinem PC.** Der Dienst liegt in Cloudflares Rechenzentren
und läuft dort rund um die Uhr weiter, auch wenn dein Rechner aus ist.

| Baustein | Wo | Was er tut |
|---|---|---|
| Worker | Cloudflare-Edge, weltweit | nimmt Anmeldungen an, bestätigt, meldet ab |
| D1-Datenbank | Cloudflare | speichert die Abonnenten |
| Cron-Trigger | Cloudflare | weckt den Worker stündlich |
| Mail-Versand | Resend oder Brevo | verschickt die Mails |

Dein PC wird nur einmal gebraucht: um den Worker **hochzuladen** (`wrangler deploy`).
Danach kannst du ihn ausschalten, formatieren oder verkaufen — der Newsletter läuft weiter.

Auch die Website selbst braucht den Worker nicht. Kalender, Filter, ICS-Feeds und die
Google-Calendar-Knöpfe funktionieren ohne ihn. Er ist ein Anbauteil für genau ein Feature.

## Stand dieser Installation

| | |
|---|---|
| Worker | `https://newsletter.animekalender.workers.dev` |
| D1-Datenbank | `anime-kalender`, Region WEUR (Westeuropa) |
| Cron | stündlich, versendet um 07:00 Berliner Zeit |
| Mail-Anbieter | Resend |
| Absender | `onboarding@resend.dev` — **Übergangslösung, siehe unten** |

### ⚠ Offener Punkt: Absenderdomain

Solange als Absender `onboarding@resend.dev` eingetragen ist, liefert Resend **nur an die
Adresse des Kontoinhabers** aus. Fremde Abonnenten bekommen nichts — Resend lehnt den Versand
ab. Zum Testen reicht das, für den öffentlichen Betrieb nicht.

Behoben wird das, indem in Resend unter *Domains* eine eigene Domain verifiziert wird (drei
DNS-Einträge: MX, SPF/TXT und DKIM). Danach `FROM_EMAIL` in `wrangler.toml` auf eine Adresse
dieser Domain umstellen und neu deployen.

## Was du einmalig tun musst

Voraussetzung: ein Cloudflare-Konto (kostenlos, ohne Kreditkarte) und ein Konto bei einem
Mail-Anbieter. Rechne mit 20 Minuten.

### 1. Anmelden und Projekt vorbereiten

```bash
cd worker
npm install
npx wrangler login        # öffnet den Browser, einmal bestätigen
```

### 2. Datenbank anlegen

```bash
npx wrangler d1 create anime-kalender
```

Der Befehl gibt eine `database_id` aus. Diese in `wrangler.toml` bei `database_id` eintragen
— dort steht bis dahin ein Platzhalter.

Dann die Tabellen anlegen:

```bash
npm run db:init:remote
```

### 3. Mail-Anbieter wählen

|  | Resend | Brevo |
|---|---|---|
| Gratis | 3.000 Mails/Monat | 300 Mails/Tag |
| Eigene Domain nötig? | **ja**, sonst gehen Mails nur an dich selbst | nein, verifizierte Absenderadresse genügt |
| Einrichtung | Domain-DNS-Einträge setzen | Adresse per Klick bestätigen |

Ohne eigene Domain also **Brevo** nehmen. Danach den API-Key hinterlegen:

```bash
npx wrangler secret put MAIL_API_KEY
```

Der Key landet verschlüsselt bei Cloudflare, nicht im Repository.

### 4. Einstellungen in `wrangler.toml`

```toml
MAIL_PROVIDER = "brevo"                 # brevo | resend | console
FROM_EMAIL    = "kalender@deine-domain.de"
FROM_NAME     = "Anime-Kalender DE"
WORKER_URL    = "https://anime-kalender-newsletter.DEIN-SUBDOMAIN.workers.dev"
ALLOWED_ORIGIN = "https://anime-kalender.de"
SITE_URL      = "https://anime-kalender.de/"
```

`WORKER_URL` kennst du erst nach dem ersten Deploy — also einmal deployen, die ausgegebene
Adresse eintragen, ein zweites Mal deployen.

### 5. Hochladen

```bash
npm run deploy
```

### 6. Website mit dem Worker verbinden

Im Repository unter **Settings → Secrets and variables → Actions → Variables** eine Variable
`NEWSLETTER_API_URL` mit der Worker-Adresse anlegen. Beim nächsten Deploy backt der Build sie
in die Seite ein, und das Anmeldeformular ist scharf. Ohne diese Variable zeigt das Formular
einen ehrlichen Hinweis statt eines Knopfes, der ins Leere führt.

## Vor dem Livegang

- Impressum und Datenschutzerklärung müssen stimmen — beide sind über den Fuß der Seite
  erreichbar und im Code hinterlegt.
- Einmal selbst anmelden und den ganzen Weg durchspielen: Bestätigungsmail, Bestätigungslink,
  Digest, Abmeldelink.

## Örtlich ausprobieren

```bash
npm run db:init      # lokale Kopie der Datenbank
npm run dev          # startet auf http://localhost:8787
```

Mit `MAIL_PROVIDER = "console"` geht dabei keine einzige echte Mail raus; der Inhalt landet
im Terminal. Genau so testet man den Versand, ohne jemandem Post zu schicken.

Den Versand von Hand auslösen, ohne auf 07:00 Uhr zu warten:

```bash
curl "http://localhost:8787/__scheduled?cron=0+*+*+*+*"
```

## Endpunkte

| Route | Zweck |
|---|---|
| `POST /subscribe` | `{ email, frequency: "daily"\|"weekly", platforms: [] }` → Bestätigungsmail |
| `GET /confirm?token=…` | schaltet das Abo scharf |
| `GET /unsubscribe?token=…` | löscht den Datensatz |
| `GET /health` | Anzahl aktiver Abos |
| `GET /status` | letzter Stand aller überwachten Seiten |
| `GET /debug/digest?token=…` | Newsletter-Versand von Hand auslösen |
| `GET /debug/monitor?token=…` | Erreichbarkeitsprüfung von Hand auslösen |

## Erreichbarkeitsprüfung

Derselbe stündliche Cron prüft alle gehosteten Seiten — die Liste steht in
[`src/sites.ts`](src/sites.ts), eine Zeile je Seite.

Warum hier und nicht bei einem der üblichen Dienste: Die melden sich **bei
Zustandswechsel**. Flackert eine Seite, kommen Dutzende Mails. Gefordert war
höchstens eine pro Tag — das ist hier eine Zeile Logik statt einer Einstellung,
die es so nirgends gibt.

Entscheidend ist der Ort: Cloudflare liegt **außerhalb** aller überwachten
Hoster (GitHub Pages, Plesk, lima-city). Ein Wächter auf derselben
Infrastruktur wie das Bewachte wäre wertlos.

**Wann was verschickt wird**

- **Störung**: höchstens **einmal am Tag**, mit allen betroffenen Seiten, dem
  Grund und dem Zeitpunkt der letzten erfolgreichen Prüfung.
- **Wochenübersicht**: montags, auch wenn alles läuft. Das ist keine Statistik,
  sondern der Lebensnachweis des Wächters — bleibt sie aus, ist er tot. Aus
  demselben Grund steht der Dienst **nicht** in seiner eigenen Prüfliste: Ein
  Dienst, der sich selbst überwacht, schweigt genau dann, wenn er ausfällt.

**Was geprüft wird** — nicht nur der Statuscode: Eine Seite, die brav 200 meldet
und dabei einen leeren Rumpf liefert, gilt als kaputt (`minBytes`), ebenso eine,
in der ein erwarteter Text fehlt (`expect`). Abgelaufene Zertifikate fallen als
Verbindungsfehler auf; die Restlaufzeit im Voraus zu lesen, geht in einem Worker
nicht.

Neue Seite aufnehmen: Zeile in `src/sites.ts` ergänzen, `npm run deploy`.

## Wann verschickt wird

Der Cron läuft **stündlich** und prüft selbst, ob es in Berlin gerade `SEND_HOUR_BERLIN`
(Standard 7) ist. So stimmt der Zeitpunkt auch nach der Sommerzeitumstellung, ohne zwei
Cron-Einträge zu verbrauchen — der kostenlose Tarif erlaubt nur drei.

- **täglich**: die Termine des heutigen Tages
- **wöchentlich**: montags, die Termine der nächsten sieben Tage

### Favoriten stehen oben

Die Mail trennt **„★ Deine Favoriten"** von den übrigen Releases, und der Betreff nennt zuerst,
was den Leser wirklich betrifft — eine neue Folge einer verfolgten Serie wiegt schwerer als ein
beliebiges Disc-Release.

Die Favoriten liegen im `localStorage` des Nutzers; der Dienst kennt sie nicht von allein. Sie
werden bei der Anmeldung mitgeschickt und in D1 gespiegelt. Damit sie nicht veralten, trägt jede
Mail einen Abgleich-Link mit **eigenem** Token (`pref_token`, getrennt vom Abmelde-Token):
`…/#/newsletter?sync=<token>` — beim Öffnen schickt die Seite ihren aktuellen Stand an
`POST /favorites`.

Wer noch keine Favoriten hinterlegt hat, findet in der Mail einen Hinweis darauf. Wer welche hat,
sieht ihn nicht — sonst wäre er Lärm.

Die Tabelle `send_log` verhindert Doppelversand, falls ein Cron zweimal feuert. Wer nur
bestimmte Plattformen abonniert hat, bekommt keine Mail, wenn in seinem Zeitfenster nichts
Passendes liegt.

Die Termine holt sich der Worker aus derselben `events.json`, die auch die Website lädt —
es gibt also keine zweite Wahrheit, die auseinanderlaufen könnte.

## Datenschutz

Gespeichert werden Adresse, Rhythmus, Plattformwahl sowie Zeitpunkt und IP von Anmeldung und
Bestätigung — Letzteres als Nachweis der Einwilligung. Die Abmeldung löscht die Zeile
vollständig; es bleibt kein Rest zurück.

## Was es kostet

Nichts, solange die Abonnentenzahl im dreistelligen Bereich bleibt. Cloudflare rechnet den
freien Tarif mit 100.000 Worker-Aufrufen und 5 Millionen D1-Lesevorgängen pro Tag ab; ein
täglicher Digest an 500 Leute verbraucht davon einen Bruchteil. Die Grenze setzt eher der
Mail-Anbieter: 300 Mails/Tag bei Brevo heißt maximal 300 tägliche Abonnenten.
