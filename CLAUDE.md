# UI Components

## Namenskonvention: Dateien & Ordner

Ordner- und Dateinamen werden in **camelCase** geschrieben.

- Einzelwörter bleiben klein: `accordion`, `countdown`, `dialog`, `marquee`, `tabs`
- Mehrwort-Namen: erster Buchstabe klein, jedes weitere Wort groß-anfangend
  - Beispiel: `dateinputformat` → `dateInputFormat`, `stickyobserver` → `stickyObserver`
- **Abkürzungen werden komplett großgeschrieben**: `SVG`, nicht `Svg`
  - Beispiel: `inlineSVG`, `scaleSVG`
- Der Dateiname der Hauptkomponente entspricht dem Ordnernamen
  - Beispiel: `stickyObserver/stickyObserver.js`
- **Präfixe bleiben erhalten**, nur der Teil dahinter wird camelCase:
  - `dev_`-Präfix (Entwickler-Tools): `dev_pageInfo.js`, `dev_qrCode.js`
  - `_shared/` (führender Unterstrich = geteilter/interner Ordner)

## Aufbau / Build

- `_shared/js/registry.js` ist **von Gulp auto-generiert** — nicht manuell als Quelle behandeln;
  Änderungen ergeben sich aus den Modul-Dateinamen beim Build.
- Die relativen Imports in den Komponenten (z. B. `import ... from "./debounce.js"`)
  sind relativ zum **Build-Output** (`_shared/js/modules/`), nicht zur physischen
  Ordnerstruktur. Umbenennen der Komponenten-Ordner bricht diese Imports daher nicht.
- Modul-IDs in `data-js-module="…"` im Markup entsprechen den Registry-Keys
  (= den camelCase-Modulnamen).

## Noch offen / bewusst nicht angepasst

Diese folgen (noch) nicht der camelCase-Konvention, da sie keine Datei-/Ordnernamen sind
und eine Änderung eine API-/Markup-Anpassung erfordern würde:

- Console-Präfixe in Warnungen, z. B. `[stickyobserver]`, `[responsivevideo]`
- HTML-`data`-Attribute, z. B. `data-inputcharcount`, `data-responsivevideoControls`
