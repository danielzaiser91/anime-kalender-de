/** Aktionen auf Vorschlägen: Mengen im Browser fortschreiben und die Galerie nachrücken lassen. */

/** Die Schreib-/Lese-Schnittstelle von `createIdSet`; Tests setzen eine Attrappe ein. */
export interface IdMenge {
  read: () => Set<number>
  write: (ids: Set<number>) => void
}

export function fuegeHinzu(menge: IdMenge, id: number): void {
  menge.write(new Set([...menge.read(), id]))
}

export function nimmWeg(menge: IdMenge, id: number): void {
  const neu = new Set(menge.read())
  neu.delete(id)
  menge.write(neu)
}

export interface VorschlagAktionen {
  favorit: (id: number) => void
  gesehen: (id: number) => void
  nein: (id: number) => void
  oeffne: (id: number) => void
}

/** „Schon gesehen“ geht in die Gesehen-Menge, „Nicht interessiert“ in die Verworfenen; beide lassen den nächsten Titel nachrücken. */
export function baueAktionen(teile: {
  gesehen: IdMenge
  verworfen: IdMenge
  favorit: (id: number) => void
  oeffne: (id: number) => void
  entferne: (id: number) => void
}): VorschlagAktionen {
  return {
    favorit: teile.favorit,
    oeffne: teile.oeffne,
    gesehen: (id) => {
      fuegeHinzu(teile.gesehen, id)
      teile.entferne(id)
    },
    nein: (id) => {
      fuegeHinzu(teile.verworfen, id)
      teile.entferne(id)
    },
  }
}
