# Design: Line-Chart-Karte "B4 Kostenentwicklung"

## Kontext

`todo.md` fordert eine Line-Chart-Karte für die B4-Kostenentwicklung mit täglichen,
akkumulierten Testdaten (Wachstum 0,1–0,2 % pro Tag) über 2024, 2025 und 2026 bis
heute, sowie einem Jahresfilter. Die App ist eine SAP Fiori Overview Page (`sap.ovp`,
OData V2, UI5 1.96.49) unter `opexample/`. Es existiert bereits eine List-Card
(`vertragStatistikenCard`, Entity `VertragStatistik`) und eine vorbereitete, aber
nicht registrierte Stacked-Column-Chart-Annotation für `JahresWert` (B0–B4 pro Jahr).
Diese bestehenden Elemente dienen als Vorlage für Namenskonventionen und
Card-Konfiguration.

Der Jahresfilter soll (auf Wunsch des Nutzers) über die **globale SmartFilterBar**
der Overview Page realisiert werden, nicht als Card-interne Tabs.

## Datenmodell

Neue Entity `B4Zahlung` / EntitySet `B4Zahlungen` in
`webapp/localService/mainService/metadata.xml` (analog zu `JahresWert`):

- `Datum` (Edm.DateTime, Key, `sap:aggregation-role="dimension"`, Label "Datum")
- `Jahr` (Edm.String, MaxLength 4, `sap:aggregation-role="dimension"`, Label "Jahr")
  — abgeleitet aus `Datum`, dient ausschließlich dem globalen Jahresfilter
  (Property-Name-Matching, siehe unten)
- `B4` (Edm.Decimal, Precision 18, Scale 2, `sap:aggregation-role="measure"`,
  Label "B4 Zahlungen (kumuliert)")

Mock-Daten: neue Datei `webapp/localService/mainService/data/B4Zahlungen.json`.

## Testdaten-Generierung

- Täglicher Datensatz vom 01.01.2024 bis 03.07.2026 (heute) → 915 Zeilen.
- Startwert 01.01.2024: **19.655,76 €**.
- Für jeden Folgetag: `Wert(t) = Wert(t-1) * (1 + r)`, wobei `r` ein
  pseudozufälliger Faktor zwischen 0,1 % und 0,2 % ist (deterministisch erzeugt
  mit festem Seed, damit die Datei bei Bedarf reproduzierbar neu generiert werden
  kann). Werte werden auf 2 Nachkommastellen gerundet.
- Jede Zeile bekommt zusätzlich `Jahr` (String, aus dem Jahr von `Datum`
  abgeleitet: "2024", "2025" oder "2026").
- Die Testdaten werden einmalig per Skript erzeugt und als statische JSON-Datei
  abgelegt (kein Laufzeit-Generator im Produktivcode).

## Globaler Jahresfilter

OVP bindet die globale SmartFilterBar an genau eine Entity
(`sap.ovp.globalFilterEntitySet`) und deren `UI.SelectionFields`-Annotation. Ein
dort gewählter Filterwert wird automatisch auf **jede** Card angewendet, deren
gebundener Entity-Type eine Property mit demselben Namen besitzt (Property-Name-
Matching über Entity-Set-Grenzen hinweg) — unabhängig vom Card-Entity-Set.

Aktuell ist `globalFilterEntitySet: "VertragStatistiken"` mit Filterfeld `Status`
(`UI.SelectionFields` auf `VertragStatistik`). Da die Filterleiste nur an eine
Entity gebunden werden kann, wird `Jahr` als zweites Feld auf derselben Entity
ergänzt statt `globalFilterEntitySet` zu wechseln (damit der bestehende
`Status`-Filter erhalten bleibt):

1. `VertragStatistik`-Entity bekommt zusätzlich `Jahr` (Edm.String, MaxLength 4,
   Nullable, Label "Jahr"). Nicht Teil von `UI.LineItem` (erscheint nicht als
   Spalte in der bestehenden List-Card).
2. Die 3 bestehenden Zeilen in `VertragStatistiken.json` bekommen je einen
   Jahreswert: "Geplant" → 2026, "In Vergabe" → 2025, "Beauftragt" → 2024 — damit
   das Value-Help der Filterleiste genau die 3 relevanten Jahre anbietet.
3. `UI.SelectionFields` auf `VertragStatistik` wird um `<PropertyPath>Jahr</PropertyPath>`
   erweitert.
4. `B4Zahlung` bekommt (siehe oben) ebenfalls `Jahr` — dadurch greift die globale
   Filterauswahl automatisch auf die neue Card, ohne dass die Card selbst
   Filter-Logik kennt.
5. Ohne Filterauswahl (initialer Seitenaufruf) zeigt die Card alle 915 Tageswerte
   (2024–heute) an.

## Card-Konfiguration

Neue Annotation `UI.Chart` auf `B4Zahlung` in `webapp/annotations/annotation.xml`:
- `ChartType`: `UI.ChartType/Line`
- `Dimensions`: `[Datum]`
- `Measures`: `[B4]`

Neue Card `b4KostenentwicklungCard` in `manifest.json` unter `sap.ovp.cards`,
analog zum bestehenden (unregistrierten) `jahresWerteCard`-Muster:

```json
"b4KostenentwicklungCard": {
  "model": "mainModel",
  "template": "sap.ovp.cards.charts.analytical",
  "settings": {
    "title": "{{b4KostenentwicklungCard_title}}",
    "subTitle": "{{b4KostenentwicklungCard_subtitle}}",
    "entitySet": "B4Zahlungen",
    "chartAnnotationPath": "com.sap.vocabularies.UI.v1.Chart"
  }
}
```

Keine Tabs, keine `selectionAnnotationPath` — Filterung läuft ausschließlich über
die globale SmartFilterBar.

## Texte (i18n)

In `webapp/i18n/i18n.properties`:
- `b4KostenentwicklungCard_title` = "B4 Kostenentwicklung"
- `b4KostenentwicklungCard_subtitle` = "Akkumulierte Zahlungen im Zeitverlauf"
- Label für `Jahr`-Filterfeld ergibt sich aus `sap:label` in der metadata.xml
  (kein separater i18n-Key nötig, analog zu bestehenden Feldern).

## Geänderte / neue Dateien

- `webapp/localService/mainService/metadata.xml` — neue Entity `B4Zahlung` +
  EntitySet `B4Zahlungen`; `Jahr`-Property auf `VertragStatistik` ergänzt
- `webapp/localService/mainService/data/B4Zahlungen.json` — neu, 915 Zeilen
- `webapp/localService/mainService/data/VertragStatistiken.json` — `Jahr`-Werte
  ergänzt
- `webapp/annotations/annotation.xml` — `UI.Chart` auf `B4Zahlung`;
  `UI.SelectionFields` auf `VertragStatistik` um `Jahr` erweitert
- `webapp/manifest.json` — neue Card `b4KostenentwicklungCard`
- `webapp/i18n/i18n.properties` — neue Texte

## Out of Scope

- Der offene Donut-Chart-Task (Bereich S/H/Q/M/W) aus `todo.md` ist nicht Teil
  dieser Änderung.
- Die entfernte `jahresWerteCard` (Stacked Column, B0–B4 pro Jahr) wird nicht
  wiederhergestellt.
