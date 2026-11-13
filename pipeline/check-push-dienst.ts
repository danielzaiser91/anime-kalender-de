/**
 * Zusicherungen zu `istPushDienst()` aus `worker/src/push-dienst.ts`: Die Prüfung ist die einzige Sperre gegen einen offenen
 * Weiterleiter (der Worker ruft den gemeldeten Endpunkt ab). Erlaubt sind die bekannten Push-Dienste genau oder als Unterdomäne mit
 * Punkt davor; abgelehnt wird jede Teilwort- oder Anhang-Falle, http, ein eigener Port, Zugangsdaten und Unlesbares. Läuft in `check:logic`.
 */
import { istPushDienst } from '../worker/src/push-dienst.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

const erlaubt = [
  'https://fcm.googleapis.com/fcm/send/abc:def',
  'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
  'https://web.push.apple.com/QGuQ',
  'https://wns2-par02p.notify.windows.com/w/?token=x',
  'https://eu.push.services.mozilla.com/x',
  'https://api.push.apple.com/x',
  'https://FCM.GoogleAPIs.com/fcm/send/x',
  'https://fcm.googleapis.com:443/fcm/send/x',
]
for (const e of erlaubt) pruefe(`erlaubt: ${e}`, istPushDienst(e), true)

const abgelehnt: [string, string][] = [
  ['http statt https', 'http://fcm.googleapis.com/fcm/send/x'],
  ['eigener Port', 'https://fcm.googleapis.com:8443/fcm/send/x'],
  ['Benutzername', 'https://nutzer@fcm.googleapis.com/x'],
  ['Kennwort', 'https://:geheim@fcm.googleapis.com/x'],
  ['Dienst als Präfix eines fremden Rechners', 'https://fcm.googleapis.com.evil.example/x'],
  ['Endung mitten im fremden Rechner', 'https://a.push.apple.com.evil.example/x'],
  ['Windows-Endung mitten im fremden Rechner', 'https://wns.notify.windows.com.evil.example/x'],
  ['Dienst im Pfad','https://evil.example/fcm.googleapis.com'],
  ['Dienst in der Abfrage', 'https://evil.example/?h=fcm.googleapis.com'],
  ['Unterdomäne von googleapis ohne Liste', 'https://evil.googleapis.com/x'],
  ['Unterdomäne von fcm ist nicht genau', 'https://x.fcm.googleapis.com/x'],
  ['Endung ohne Punkt davor (Windows)', 'https://evilnotify.windows.com/x'],
  ['Endung ohne Punkt davor (Apple)', 'https://evilpush.apple.com/x'],
  ['nackte Endung (Windows)', 'https://notify.windows.com/x'],
  ['nackte Endung (Mozilla)', 'https://push.services.mozilla.com/x'],
  ['Punkt am Ende', 'https://fcm.googleapis.com./x'],
  ['IP-Adresse', 'https://142.250.0.1/x'],
  ['kein URL', 'fcm.googleapis.com/fcm/send/x'],
  ['leer', ''],
  ['anderes Schema', 'wss://fcm.googleapis.com/x'],
]
for (const [text, e] of abgelehnt) pruefe(`abgelehnt: ${text}`, istPushDienst(e), false)

if (fehler) {
  console.error(`check-push-dienst: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-push-dienst: ok')
