/**
 * Die YouTube-Verweise prüfen, ohne YouTube zu scrapen.
 *
 * ## Warum oEmbed
 *
 * YouTube betreibt unter `/oembed` eine dokumentierte, öffentliche
 * Schnittstelle: Sie nimmt eine Videoadresse und gibt Titel, Kanal und
 * Vorschaubild zurück. Kein Schlüssel, kein Kontingent, und `robots.txt`
 * sperrt sie nicht — geprüft am 22.08.2026, gesperrt sind dort nur
 * `/watch_ajax` und Verwandte.
 *
 * Damit lassen sich zwei Fragen beantworten, für die bisher niemand Zeit hatte:
 *
 * - **Lebt der Verweis noch?** Ein gelöschtes oder gesperrtes Video antwortet
 *   mit 404 oder 401. 93 Verweise stehen im Datensatz, jeder davon eine Kachel,
 *   die einen Besucher ins Leere schicken kann.
 * - **Welche Fassung ist es?** Der Titel verrät sie oft: „Pokémon – Der Film"
 *   ist die deutsche, „Akira" sagt nichts. Das ist ein **Hinweis**, kein Beleg —
 *   ein deutscher Titel kann über einem Video mit Originalton stehen. Er landet
 *   deshalb in einer Vorschlagsliste, nicht im Datensatz.
 *
 * ## Was hier nicht passiert
 *
 * Es wird nichts gerendert und keine Seite gelesen. Wer mehr will — etwa die
 * Tonspuren eines Videos —, braucht die Data API mit Schlüssel und Kontingent;
 * das ist eine eigene Entscheidung und keine Nebensache dieses Skripts.
 *
 * Aufruf: node pipeline/check-youtube.mjs [--limit N] [--pause MS]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// Die beiden Titel-Muster stehen an einer Stelle: Der Bericht braucht
// dieselben, und zwei Fassungen liefen garantiert auseinander.
import { DEUTSCHE_SPUR, ANDERE_FASSUNG } from './lib/titel-muster.mjs'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const zahl = (name, standard) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? Number(args[i + 1]) : standard
}
const LIMIT = zahl('--limit', 0)
const PAUSE = zahl('--pause', 350)

const titel = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
const liste = Array.isArray(titel) ? titel : (titel.titles ?? Object.values(titel))

/** Alle YouTube-Verweise, deren Sprachfassung offen ist. */
const offen = []
for (const t of liste) {
  for (const s of t.streams ?? []) {
    if (s.platform !== 'youtube' || s.dub !== undefined) continue
    offen.push({ id: t.id, titel: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id), url: s.url })
  }
}

const ZIEL = resolve(wurzel, 'data/youtube-befunde.json')
const bestand = existsSync(ZIEL) ? JSON.parse(readFileSync(ZIEL, 'utf8')) : {}


let gelesen = 0
let tot = 0
let kasse = 0
let deutsch = 0
let belegt = 0

/**
 * Die Tonspur, die YouTube selbst auf der Seite nennt.
 *
 * Daniel am 23.08.2026, mit Bild: „da steht doch eindeutig audio deutsch, also
 * musst du es auch automatisch bekommen können." Er hat recht — die Angabe
 * steht **strukturiert** im HTML, gleich dreifach:
 *
 *     {"metadataRowRenderer":{"title":{"runs":[{"text":"Audio"}]},
 *                             "contents":[{"simpleText":"Deutsch"}]}}
 *     {"metadataLineRenderer":{"text":{"simpleText":"Audio: Deutsch"}}}
 *     {"factoidRenderer":{"value":{"simpleText":"Deutsch"},
 *                         "label":{"simpleText":"Hauptsprache"}}}
 *
 * Das ist kein Auslesen der Seitenanzeige, sondern die JSON-Fracht, aus der
 * sich die Seite selbst bedient — ein Abruf, kein Rendern. `robots.txt` sperrt
 * `/watch` nicht (nur `/watch_ajax` und Verwandte).
 *
 * **Die Angabe gibt es nur, wo YouTube sie kennt** — bei Filmen und Serien aus
 * dem eigenen Angebot. Ein hochgeladenes Video hat sie nicht; dort kommt `null`
 * zurück, und das heißt „unbekannt", nicht „kein Deutsch".
 */
/**
 * Was die Videoseite hergibt, wenn oEmbed die Auskunft verweigert.
 *
 * oEmbed antwortet bei eingeschraenkter Einbettung mit 401 und sagt danach gar
 * nichts mehr — kein Titel, kein Kanal, keine Tonspur. Bis zum 24.08.2026 gab
 * der Lauf dort auf und schrieb `kostenpflichtig: true` in den Bestand, als
 * waere 401 gleichbedeutend mit "kostet Geld".
 *
 * **Gemessen ist es das nicht.** Alle neun 401-Faelle vom 22.08.2026 an ihrer
 * Videoseite geprueft (24.08.2026):
 *
 * | Befund | Zahl | Beispiele |
 * |---|---|---|
 * | `offerId` vorhanden — Kauf oder Leihe | 6 | Your Name, FF7 Advent Children, Fireworks |
 * | kein Kaufangebot | 3 | Tokyo Ghoul (OmU), My Hero Academia (OmU), Princess Knight |
 *
 * Drei von neun standen also mit einer Preisangabe im Kalender, die niemand
 * gemessen hatte — und zwei davon sind Folgen **mit Untertiteln statt Synchro**,
 * was ihr eigener Videotitel sagt ("Tokyo Ghoul, 2. Staffel, 1. Episode, OmU").
 *
 * `offerId` ist der Beleg: YouTube nennt darin die konkrete Kaufoption. Fehlt
 * sie, heisst das "kein Kaufangebot gefunden" — der Grund fuer den 401 ist dann
 * ein anderer (Altersfreigabe, Einbettungssperre), und der Verweis bleibt bei
 * dem, was er vorher war.
 */
async function videoseite(url) {
  try {
    const antwort = await fetch(url, {
      headers: {
        'Accept-Language': 'de-DE,de;q=0.9',
        // Ohne Browser-Kennung liefert YouTube eine abgespeckte Seite ohne die
        // JSON-Fracht, aus der hier gelesen wird.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36',
      },
    })
    if (!antwort.ok) return null
    const html = await antwort.text()
    return {
      videoTitel: /<meta name="title" content="([^"]*)"/.exec(html)?.[1] ?? null,
      kanal: /"ownerChannelName":"([^"]+)"/.exec(html)?.[1] ?? null,
      kaufAngebot: /"offerId":"[^"]+"/.test(html),
      kategorie: /"category":"([^"]+)"/.exec(html)?.[1] ?? null,
      /*
        **Die Tonspur steht in derselben Seite — sie wurde nur nie gelesen.**
        Bis zum 29.08.2026 holte nur der 200er-Zweig die Sprachangabe; wer mit
        401 hier landete, blieb ohne. Genau die Kauf- und Leihtitel bei YouTube
        Movies antworten aber mit 401, und ihre Seite nennt „Audio: Deutsch"
        so deutlich wie jede andere. Ein zweiter Abruf wäre Verschwendung: das
        HTML liegt hier bereits.
      */
      audio: audioAus(html),
    }
  } catch {
    return null
  }
}

function audioAus(html) {
  const muster = [
    /\{"text":"Audio"\}\]\},"contents":\[\{"simpleText":"([^"]+)"/,
    /"simpleText":"Audio: ([^"]+)"/,
    /"value":\{"simpleText":"([^"]+)"\},"label":\{"simpleText":"Hauptsprache"/,
  ]
  for (const m of muster) {
    const treffer = m.exec(html)
    if (treffer) return treffer[1]
  }
  return null
}

async function tonspur(url) {
  try {
    const antwort = await fetch(url, { headers: { 'Accept-Language': 'de-DE,de;q=0.9' } })
    if (!antwort.ok) return null
    return audioAus(await antwort.text())
  } catch {
    return null
  }
}

/**
 * **Eine Playlist-Seite nennt keine Tonspur — ihre Videos tun es.**
 *
 * Zehn der 22 offenen YouTube-Verweise zeigten am 29.08.2026 auf eine Playlist
 * (`?list=…` ohne `v=`). Dort greift `tonspur()` ins Leere: Das Audio-Menü
 * gehört zum Abspieler eines Videos, nicht zur Sammlung. Der Verweis blieb
 * darum offen, obwohl die Auskunft eine Ebene tiefer bereitliegt.
 *
 * Geholt wird das **erste** Video der Liste. Für ein `dub: true` genügt das:
 * Die Aussage lautet „hinter diesem Verweis gibt es deutschen Ton", und ein
 * deutsches Video belegt sie. Für ein `dub: false` würde es nicht genügen —
 * das behauptet dieser Weg auch nicht.
 */
async function erstesVideoDerPlaylist(url) {
  try {
    const antwort = await fetch(url, {
      headers: {
        'Accept-Language': 'de-DE,de;q=0.9',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36',
      },
    })
    if (!antwort.ok) return null
    const html = await antwort.text()
    const treffer =
      /"playlistVideoRenderer":\{"videoId":"([\w-]{11})"/.exec(html) ?? /"videoId":"([\w-]{11})"/.exec(html)
    return treffer ? `https://www.youtube.com/watch?v=${treffer[1]}` : null
  } catch {
    return null
  }
}
const arbeit = LIMIT > 0 ? offen.slice(0, LIMIT) : offen

for (const [i, v] of arbeit.entries()) {
  const adresse = `https://www.youtube.com/oembed?url=${encodeURIComponent(v.url)}&format=json`
  let befund
  try {
    const antwort = await fetch(adresse)
    /**
     * 404 heißt gelöscht. 401 heißt **nichts Bestimmtes** — und das ist der
     * Unterschied, der hier zählt.
     *
     * Am 22.08.2026 antworteten neun Verweise mit 401, und dieser Kommentar
     * behauptete: „sie liegen bei YouTube Movies zum Kaufen oder Leihen". Am
     * 24.08.2026 an ihren Videoseiten nachgemessen — **sechs** tun das, drei
     * nicht. Unter den dreien: „Tokyo Ghoul, 2. Staffel, 1. Episode, **OmU**"
     * und „My Hero Academia, Episode 01, **OmU**", also Folgen mit Untertiteln
     * statt Synchro, dazu eine kostenlose Auftaktfolge von „Princess Knight".
     *
     * Der 401 hat mehrere Ursachen — Kaufangebot, Altersfreigabe,
     * Einbettungssperre —, und oEmbed nennt keine davon. Statt zu raten wird
     * seither die Videoseite gelesen: `offerId` ist dort der Beleg für ein
     * Kaufangebot, sein Fehlen ist Schweigen und kein Gegenbeleg.
     *
     * Nicht gelöscht wird in keinem Fall: Ein 401 ist keine Aussage darüber,
     * ob es das Video gibt.
     */
    if (antwort.status === 404) {
      befund = { status: 404, lebt: false }
      tot++
    } else if (antwort.status === 401 || antwort.status === 403) {
      // oEmbed schweigt hier. Die Videoseite tut es nicht — sie nennt Titel,
      // Kanal und, wenn es eins gibt, das Kaufangebot.
      const seite = await videoseite(v.url)
      befund = {
        status: antwort.status,
        lebt: true,
        ...(seite ?? {}),
        // Nur ein gefundenes Kaufangebot ist ein Beleg. Konnte die Seite nicht
        // gelesen werden, bleibt die Frage offen statt falsch beantwortet.
        kostenpflichtig: seite?.kaufAngebot === true ? true : undefined,
      }
      if (seite?.audio) {
        befund.audioDeutsch = /deutsch|german/i.test(seite.audio)
        if (befund.audioDeutsch) belegt++
      }
      if (seite?.videoTitel) {
        befund.deutscherTitel = DEUTSCHE_SPUR.test(seite.videoTitel)
        befund.andereFassung = ANDERE_FASSUNG.test(seite.videoTitel)
      }
      if (befund.kostenpflichtig) kasse++
    } else if (!antwort.ok) {
      // Ein anderer Fehler ist keine Auskunft — beim nächsten Lauf noch einmal.
      console.log(`  ${i + 1}/${arbeit.length} ? ${v.titel.slice(0, 34)} — HTTP ${antwort.status}`)
      continue
    } else {
      const daten = await antwort.json()
      befund = {
        status: 200,
        lebt: true,
        videoTitel: daten.title ?? null,
        kanal: daten.author_name ?? null,
        deutscherTitel: DEUTSCHE_SPUR.test(daten.title ?? ''),
        andereFassung: ANDERE_FASSUNG.test(daten.title ?? ''),
      }
      let ton = await tonspur(v.url)
      // Playlist ohne eigene Tonspur: eine Ebene tiefer, beim ersten Video.
      if (!ton && /[?&]list=/.test(v.url) && !/[?&]v=/.test(v.url)) {
        const erstes = await erstesVideoDerPlaylist(v.url)
        if (erstes) {
          ton = await tonspur(erstes)
          if (ton) befund.audioAusVideo = erstes
        }
      }
      if (ton) {
        befund.audio = ton
        befund.audioDeutsch = /deutsch|german/i.test(ton)
        if (befund.audioDeutsch) belegt++
      }
      if (befund.deutscherTitel) deutsch++
    }
  } catch (err) {
    console.log(`  ${i + 1}/${arbeit.length} ? ${v.titel.slice(0, 34)} — ${err.message}`)
    continue
  }
  bestand[v.url] = { ...befund, anilistId: v.id, geprueftAm: new Date().toISOString().slice(0, 10) }
  gelesen++
  const zeichen = !befund.lebt
    ? '✕'
    : befund.audioDeutsch
      ? '🇩🇪'
      : befund.audio
        ? '✗'
        : befund.kostenpflichtig
          ? '€'
          : befund.deutscherTitel
            ? '?'
            : '·'
  console.log(`  ${i + 1}/${arbeit.length} ${zeichen} ${v.titel.slice(0, 40)}`)
  await new Promise((r) => setTimeout(r, PAUSE))
}

writeFileSync(ZIEL, JSON.stringify(bestand, null, 1) + '\n')
console.log('')
console.log(
  `${gelesen} Verweise geprüft: ${belegt} mit „Audio: Deutsch", ${tot} gelöscht, ` +
    `${kasse} kostenpflichtig, ${deutsch} mit deutschem Videotitel`,
)
console.log(`Befunde in data/youtube-befunde.json`)
