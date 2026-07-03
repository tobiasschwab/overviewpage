# Design: Donut-Chart-Karte „B4 nach Bereich" (BereichSummen)

## Kontext

Die Overview Page zeigt bereits drei Karten: „B4 Kostenentwicklung" (Liniendiagramm),
„Jahreswerte" (Stacked Column B0–B4 pro Jahr) und „Vertragsstatistiken" (Liste).
Ergänzt wird ein Donut-Chart, der die B4-Mittel nach den fünf Hochbau-/Tiefbau-Bereichen
aufteilt. Die Entity heißt `BereichSumme` / `BereichSummen` — generisch benannt, damit
später weitere Measures (B0–B3 o. ä.) ergänzt werden können ohne Umbenennung.

## Datenmodell

Neue Entity `BereichSumme` / EntitySet `BereichSummen` in
`webapp/localService/mainService/metadata.xml`:

| Property | Typ | Rolle | Nullable | Notiz |
|----------|-----|-------|----------|-------|
| `Bereich` | Edm.String, MaxLength 1 | Key, Dimension | false | "S", "H", "Q", "M", "W" |
| `Jahr` | Edm.String, MaxLength 4 | Key, Dimension | false | globaler Jahresfilter |
| `B4` | Edm.Decimal, Precision 18, Scale 2 | Measure | false | B4-Mittel für Bereich+Jahr |

EntityType-Attribut: `sap:semantics="aggregate"` (wie `JahresWert` und `B4Zahlung`).
EntitySet-Attribut: `sap:semantics="aggregate"`.

## Bereiche

| Code | Bezeichnung |
|------|-------------|
| S | Straßenbau |
| H | Hochbau |
| Q | Sachhaushalt |
| M | Mobilität |
| W | Wohnraumförderung |

## Mock-Daten

Neue Datei `webapp/localService/mainService/data/BereichSummen.json`.

55 Zeilen: 5 Bereiche × 11 Jahre (2023–2033). Die B4-Summe aller 5 Bereiche je Jahr
stimmt exakt mit `JahresWerte.B4` überein (Rundungsdifferenzen auf den letzten Cent
werden auf „W" aufgeschlagen).

Feste Prozentverteilung:

| Bereich | Anteil |
|---------|--------|
| S | 35 % |
| H | 25 % |
| Q | 15 % |
| M | 15 % |
| W | 10 % (Restbetrag) |

Beispiel 2024 (JahresWerte.B4 = 9.319.725,08):

| Bereich | B4 |
|---------|----|
| S | 3.261.903,78 |
| H | 2.329.931,27 |
| Q | 1.397.958,76 |
| M | 1.397.958,76 |
| W | 931.972,51 |
| **Summe** | **9.319.725,08** |

## Globaler Jahresfilter

`BereichSumme` hat eine `Jahr`-Property mit `sap:aggregation-role="dimension"`.
OVPs Cross-Card-Property-Name-Matching wendet den globalen `Jahr`-Filter automatisch
auf `BereichSummen` an — kein zusätzlicher Konfigurationsaufwand.

## Annotation (`annotation.xml`)

Neuer `Annotations`-Block auf `com.example.vertrag.BereichSumme`:

```xml
<Annotations Target="com.example.vertrag.BereichSumme">
    <Annotation Term="UI.Chart">
        <Record Type="UI.ChartDefinitionType">
            <PropertyValue Property="Title" String="B4 nach Bereich"/>
            <PropertyValue Property="ChartType" EnumMember="UI.ChartType/Donut"/>
            <PropertyValue Property="Dimensions">
                <Collection>
                    <PropertyPath>Bereich</PropertyPath>
                </Collection>
            </PropertyValue>
            <PropertyValue Property="DimensionAttributes">
                <Collection>
                    <Record Type="UI.ChartDimensionAttributeType">
                        <PropertyValue Property="Dimension" PropertyPath="Bereich"/>
                        <PropertyValue Property="Role" EnumMember="UI.ChartDimensionRoleType/Series"/>
                    </Record>
                </Collection>
            </PropertyValue>
            <PropertyValue Property="Measures">
                <Collection>
                    <PropertyPath>B4</PropertyPath>
                </Collection>
            </PropertyValue>
            <PropertyValue Property="MeasureAttributes">
                <Collection>
                    <Record Type="UI.ChartMeasureAttributeType">
                        <PropertyValue Property="Measure" PropertyPath="B4"/>
                        <PropertyValue Property="Role" EnumMember="UI.ChartMeasureRoleType/Axis1"/>
                    </Record>
                </Collection>
            </PropertyValue>
        </Record>
    </Annotation>
</Annotations>
```

Hinweis: Bei Donut/Pie-Charts ist `UI.ChartDimensionRoleType/Series` die korrekte
Dimensionsrolle (nicht `Category` wie bei Balken-/Liniendiagrammen).

## Card-Konfiguration (`manifest.json`)

```json
"bereichSummenCard": {
  "model": "mainModel",
  "template": "sap.ovp.cards.charts.analytical",
  "settings": {
    "title": "{{bereichSummenCard_title}}",
    "subTitle": "{{bereichSummenCard_subtitle}}",
    "entitySet": "BereichSummen",
    "chartAnnotationPath": "com.sap.vocabularies.UI.v1.Chart"
  }
}
```

## i18n (`i18n.properties`)

```properties
bereichSummenCard_title=B4 nach Bereich
bereichSummenCard_subtitle=Verteilung der B4-Mittel
```

## Geänderte / neue Dateien

| Datei | Änderung |
|-------|----------|
| `webapp/localService/mainService/metadata.xml` | EntityType `BereichSumme` + EntitySet `BereichSummen` |
| `webapp/localService/mainService/data/BereichSummen.json` | neu, 55 Zeilen |
| `webapp/annotations/annotation.xml` | `UI.Chart` auf `BereichSumme` |
| `webapp/manifest.json` | Card `bereichSummenCard` |
| `webapp/i18n/i18n.properties` | 2 neue Texte |

## Out of Scope

- Labels/Tooltips für Bereich-Codes (S, H, Q, M, W) — OVP zeigt den Code-Wert;
  Langtext-Mapping über `sap:text` oder `Common.Text` ist ein separates Thema.
- Weitere Measures (B0–B3) — Entitätsstruktur ist bereits vorbereitet; Annotation
  und Mockdaten müssen dann ergänzt werden.
