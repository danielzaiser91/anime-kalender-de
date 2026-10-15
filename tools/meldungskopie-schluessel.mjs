/**
 * Verschlüsselung der Meldungskopie. Das Artefakt eines Laufs ist in einem öffentlichen Repo für jedes angemeldete GitHub-Konto ladbar;
 * der Worker gibt dieselben Daten nur mit `LAUF_TOKEN` heraus (`prime_folge.roh` enthält ungefilterte Player-Felder). Deshalb liegt nur
 * Geheimtext im Artefakt. Schlüssel: HKDF-SHA256 aus `LAUF_TOKEN`, das schon als Secret im Lauf und lokal als Umgebungsvariable liegt.
 * Format: 12 Byte Nonce, 16 Byte GCM-Etikett, Rest Geheimtext (AES-256-GCM).
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'

const NONCE = 12
const ETIKETT = 16

/** Der Token oder ein Abbruch: nie ohne Schlüssel hoch- oder herunterladen. */
export function tokenOderAbbruch(umgebung) {
  const token = umgebung.LAUF_TOKEN
  if (!token) throw new Error('LAUF_TOKEN fehlt: ohne ihn wird die Meldungskopie weder verschlüsselt noch entschlüsselt (Umgebungsvariable LAUF_TOKEN setzen, Wert wie das Worker-Secret)')
  return token
}

const schluessel = (token) => Buffer.from(hkdfSync('sha256', token, '', 'meldungskopie', 32))

export function verschluessle(klartext, token) {
  const nonce = randomBytes(NONCE)
  const chiffre = createCipheriv('aes-256-gcm', schluessel(token), nonce)
  const geheim = Buffer.concat([chiffre.update(klartext), chiffre.final()])
  return Buffer.concat([nonce, chiffre.getAuthTag(), geheim])
}

export function entschluessle(daten, token) {
  const dechiffre = createDecipheriv('aes-256-gcm', schluessel(token), daten.subarray(0, NONCE))
  dechiffre.setAuthTag(daten.subarray(NONCE, NONCE + ETIKETT))
  try {
    return Buffer.concat([dechiffre.update(daten.subarray(NONCE + ETIKETT)), dechiffre.final()])
  } catch {
    throw new Error('Meldungskopie lässt sich nicht entschlüsseln: LAUF_TOKEN ist nicht der Wert, mit dem der Lauf sie verschlüsselt hat')
  }
}
