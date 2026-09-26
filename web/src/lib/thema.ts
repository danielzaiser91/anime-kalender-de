import { useState } from 'react'

/** Hell oder dunkel — die Klasse am `<html>` ist die Wahrheit, `localStorage` merkt sie sich. */
export function useThema(): [boolean, () => void] {
  const [dunkel, setDunkel] = useState(() => document.documentElement.classList.contains('dark'))
  const umschalten = () => {
    const root = document.documentElement
    const neu = root.classList.toggle('dark')
    try {
      localStorage.setItem('theme', neu ? 'dark' : 'light')
    } catch {
      /* Gesperrter Speicher: Die Wahl gilt dann für diesen Besuch. */
    }
    root.style.colorScheme = neu ? 'dark' : 'light'
    setDunkel(neu)
  }
  return [dunkel, umschalten]
}
