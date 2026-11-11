// Vorlader für pipeline/check-fetch-pruefungen-unbekannt.ts: der Abruf der offenen Meldungen liefert die Zeilen aus der Datei in AK_MELDUNGEN.
// Alles andere am Netz wirft (fetch-attrappe.mjs); der Bestand liegt in der Wegwerf-Wurzel (AK_ROOT) des Tests, nichts wird umgebogen.
import { readFileSync } from 'node:fs'
import { baueFetchAttrappe, istMeldungsabruf, meldungsAntwort } from './fetch-attrappe.mjs'

const zeilen = JSON.parse(readFileSync(process.env.AK_MELDUNGEN, 'utf8'))
globalThis.fetch = baueFetchAttrappe((url, opt) => (istMeldungsabruf(url, opt) ? meldungsAntwort(zeilen) : undefined))
