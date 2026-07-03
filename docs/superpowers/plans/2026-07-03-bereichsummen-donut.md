# BereichSummen Donut Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an OVP analytical donut-chart card showing B4-Mittel distributed across five Bereiche (S, H, Q, M, W), filterable by the global Jahr filter.

**Architecture:** New `BereichSumme`/`BereichSummen` OData V2 entity (Bereich+Jahr composite key) with B4 as measure. A `UI.Chart` annotation (`ChartType/Donut`) drives a new `sap.ovp.cards.charts.analytical` card. The `Jahr` property on `BereichSumme` causes OVP's cross-card property-name-matching to automatically apply the global Jahr filter. Mock data sums per year to exactly `JahresWerte.B4` using fixed percentages (S 35%, H 25%, Q 15%, M 15%, W 10% remainder).

**Tech Stack:** SAPUI5 1.96.49, `sap.ovp` floorplan, OData V2 (`metadata.xml` + `annotation.xml`), local JSON mock via `@sap-ux/ui5-middleware-fe-mockserver`.

## Global Constraints

- Project root: `c:/Dev/ui5/overviewpage/opexample/`
- OData version: 2.0 (no V4 annotation/template syntax)
- 4-space indentation in XML files; follow existing patterns in `metadata.xml` / `annotation.xml`
- Card template: `sap.ovp.cards.charts.analytical`
- No automated test runner — verification via JSON/XML syntax validation + `npm run start-mock` smoke test
- Spec: `docs/superpowers/specs/2026-07-03-bereichsummen-donut-design.md`

---

### Task 1: Extend `metadata.xml` with `BereichSumme` entity

**Files:**
- Modify: `webapp/localService/mainService/metadata.xml`

**Interfaces:**
- Produces: EntityType `com.example.vertrag.BereichSumme` (properties `Bereich` Edm.String key/dimension, `Jahr` Edm.String key/dimension, `B4` Edm.Decimal measure) and EntitySet `BereichSummen`. Tasks 2, 3, 4 depend on these exact names.

- [ ] **Step 1: Add `BereichSumme` EntityType**

In `webapp/localService/mainService/metadata.xml`, insert the new EntityType directly after the closing `</EntityType>` of `B4Zahlung` and before `<EntityContainer ...>`:

```xml
            <EntityType Name="BereichSumme" sap:semantics="aggregate">
                <Key>
                    <PropertyRef Name="Bereich"/>
                    <PropertyRef Name="Jahr"/>
                </Key>
                <Property Name="Bereich" Type="Edm.String" MaxLength="1" Nullable="false" sap:aggregation-role="dimension" sap:label="Bereich"/>
                <Property Name="Jahr" Type="Edm.String" MaxLength="4" Nullable="false" sap:aggregation-role="dimension" sap:label="Jahr"/>
                <Property Name="B4" Type="Edm.Decimal" Precision="18" Scale="2" sap:aggregation-role="measure" sap:label="B4"/>
            </EntityType>
```

- [ ] **Step 2: Register `BereichSummen` EntitySet**

In the same file, add to `EntityContainer` after the `B4Zahlungen` EntitySet line:

```xml
                <EntitySet Name="BereichSummen" EntityType="com.example.vertrag.BereichSumme" sap:semantics="aggregate"/>
```

- [ ] **Step 3: Validate XML**

```powershell
[xml](Get-Content "webapp/localService/mainService/metadata.xml" -Raw) | Out-Null
Write-Output "XML OK"
```
Expected: `XML OK`

- [ ] **Step 4: Commit**

```bash
git add webapp/localService/mainService/metadata.xml
git commit -m "Add BereichSumme entity and BereichSummen EntitySet to metadata"
```

---

### Task 2: Generate `BereichSummen.json` mock data

**Files:**
- Create (temporary, not committed): generator script in OS scratchpad
- Create: `webapp/localService/mainService/data/BereichSummen.json`

**Interfaces:**
- Consumes: `JahresWerte.json` (to read exact B4 values per year so sums match)
- Produces: `BereichSummen.json` — 55 objects shaped `{ "Bereich": "S"|"H"|"Q"|"M"|"W", "Jahr": "2023"…"2033", "B4": <number, 2 decimals> }`, with S+H+Q+M+W summing exactly to `JahresWerte[year].B4` for each year.

- [ ] **Step 1: Write the generator script**

Write to `C:\Users\info\AppData\Local\Temp\generate-bereichsummen.js`:

```javascript
const fs = require('fs');
const path = require('path');

const jahresWerte = JSON.parse(
  fs.readFileSync('webapp/localService/mainService/data/JahresWerte.json', 'utf8')
);

const BEREICHE = ['S', 'H', 'Q', 'M', 'W'];
const PCTS = { S: 0.35, H: 0.25, Q: 0.15, M: 0.15 }; // W gets remainder

const rows = [];
for (const jw of jahresWerte) {
  const total = jw.B4;
  const s = Math.round(total * PCTS.S * 100) / 100;
  const h = Math.round(total * PCTS.H * 100) / 100;
  const q = Math.round(total * PCTS.Q * 100) / 100;
  const m = Math.round(total * PCTS.M * 100) / 100;
  const w = Math.round((total - s - h - q - m) * 100) / 100;
  const values = { S: s, H: h, Q: q, M: m, W: w };

  for (const b of BEREICHE) {
    rows.push({ Bereich: b, Jahr: jw.Jahr, B4: values[b] });
  }
}

const outPath = process.argv[2];
fs.writeFileSync(outPath, JSON.stringify(rows, null, 2) + '\n');
console.log(`Wrote ${rows.length} rows`);
console.log('Sample 2024:', rows.filter(r => r.Jahr === '2024'));
const check2024 = rows.filter(r => r.Jahr === '2024').reduce((a, r) => a + r.B4, 0);
console.log('2024 sum:', Math.round(check2024 * 100) / 100, '(expected: 9319725.08)');
```

- [ ] **Step 2: Run the generator**

```bash
node "C:\Users\info\AppData\Local\Temp\generate-bereichsummen.js" "webapp/localService/mainService/data/BereichSummen.json"
```

Expected output:
```
Wrote 55 rows
Sample 2024: [
  { Bereich: 'S', Jahr: '2024', B4: 3261903.78 },
  { Bereich: 'H', Jahr: '2024', B4: 2329931.27 },
  { Bereich: 'Q', Jahr: '2024', B4: 1397958.76 },
  { Bereich: 'M', Jahr: '2024', B4: 1397958.76 },
  { Bereich: 'W', Jahr: '2024', B4: 931972.51 }
]
2024 sum: 9319725.08 (expected: 9319725.08)
```

- [ ] **Step 3: Validate JSON and row count**

```bash
node -e "
const rows = JSON.parse(require('fs').readFileSync('webapp/localService/mainService/data/BereichSummen.json','utf8'));
console.log('count:', rows.length);
console.log('bereiche:', [...new Set(rows.map(r => r.Bereich))].sort().join(','));
console.log('jahre:', [...new Set(rows.map(r => r.Jahr))].sort().join(','));
const years = [...new Set(rows.map(r => r.Jahr))];
years.forEach(y => {
  const sum = Math.round(rows.filter(r => r.Jahr === y).reduce((a,r) => a + r.B4, 0) * 100) / 100;
  console.log('sum ' + y + ':', sum);
});
"
```
Expected: `count: 55`, `bereiche: H,M,Q,S,W`, `jahre: 2023,2024,...,2033`, and each year's sum matches the corresponding `JahresWerte.B4`.

- [ ] **Step 4: Commit**

```bash
git add webapp/localService/mainService/data/BereichSummen.json
git commit -m "Add BereichSummen mock data (55 rows, B4 per Bereich+Jahr)"
```

---

### Task 3: Add `UI.Chart` annotation for `BereichSumme`

**Files:**
- Modify: `webapp/annotations/annotation.xml`

**Interfaces:**
- Consumes: `com.example.vertrag.BereichSumme` with properties `Bereich` and `B4` (Task 1)
- Produces: `UI.Chart` annotation at `com.sap.vocabularies.UI.v1.Chart` on `BereichSumme` (consumed by card's `chartAnnotationPath` in Task 4)

- [ ] **Step 1: Add the annotation block**

In `webapp/annotations/annotation.xml`, insert a new `Annotations` block directly before the closing `</Schema>` tag (after the `B4Zahlung` annotations block):

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

Note: Donut/Pie charts require `UI.ChartDimensionRoleType/Series` (not `Category`) for the slice dimension.

- [ ] **Step 2: Validate XML**

```powershell
[xml](Get-Content "webapp/annotations/annotation.xml" -Raw) | Out-Null
Write-Output "XML OK"
```
Expected: `XML OK`

- [ ] **Step 3: Commit**

```bash
git add webapp/annotations/annotation.xml
git commit -m "Add UI.Chart Donut annotation for BereichSumme"
```

---

### Task 4: Register card and add i18n texts

**Files:**
- Modify: `webapp/manifest.json`
- Modify: `webapp/i18n/i18n.properties`

**Interfaces:**
- Consumes: `entitySet: "BereichSummen"` and `chartAnnotationPath: "com.sap.vocabularies.UI.v1.Chart"` (Tasks 1 & 3)
- Produces: OVP card `bereichSummenCard` visible on the Overview Page

- [ ] **Step 1: Add the card to `manifest.json`**

In `webapp/manifest.json`, inside `sap.ovp.cards`, add after `jahresWerteCard`:

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
      },
```

- [ ] **Step 2: Validate `manifest.json`**

```bash
node -e "JSON.parse(require('fs').readFileSync('webapp/manifest.json','utf8')); console.log('JSON OK')"
```
Expected: `JSON OK`

- [ ] **Step 3: Add i18n texts**

Append to `webapp/i18n/i18n.properties`:

```properties

#XTIT: Title of the Bereich distribution donut chart card
bereichSummenCard_title=B4 nach Bereich

#YMSG: Subtitle of the Bereich distribution donut chart card
bereichSummenCard_subtitle=Verteilung der B4-Mittel
```

- [ ] **Step 4: Commit**

```bash
git add webapp/manifest.json webapp/i18n/i18n.properties
git commit -m "Register bereichSummenCard and add i18n texts"
```

---

### Task 5: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Start the app**

```bash
npm run start-mock
```

- [ ] **Step 2: Verify the donut card renders**

In the browser confirm:
- A card titled „B4 nach Bereich" with subtitle „Verteilung der B4-Mittel" is visible.
- It renders as a donut chart with 5 segments labelled S, H, Q, M, W.
- No `DimensionAttributes are mandatory` error in the browser console.

- [ ] **Step 3: Verify the global Jahr filter**

Select `Jahr = 2024` in the filter bar and apply:
- Donut shows only 2024 data (5 segments, total ~9,3 Mio.).
- Jahreswerte, B4 Kostenentwicklung, and Vertragsstatistiken also filter to 2024 as before.

- [ ] **Step 4: Verify mock data endpoint**

In the browser console:
```javascript
fetch('/here/goes/your/serviceurl/BereichSummen?$format=json&$filter=Jahr%20eq%20%272024%27')
  .then(r => r.json()).then(d => console.log(d.d.results, 'count:', d.d.__count))
```
Expected: 5 rows, one per Bereich, B4 values summing to 9319725.08.

- [ ] **Step 5: Run lint**

```bash
npm run lint
```
Expected: no new errors.

---

## Self-Review Notes

- **Spec coverage:** Data model (Task 1), mock data (Task 2), chart annotation (Task 3), card + i18n (Task 4), smoke test + Jahr filter (Task 5) — all spec sections covered.
- **Placeholder scan:** All code blocks are complete and copy-pasteable. No TBD/TODO.
- **Type/name consistency:** `BereichSumme`/`BereichSummen`/`Bereich`/`Jahr`/`B4` and `bereichSummenCard` used identically across all tasks. `DimensionRoleType/Series` used in both annotation (Task 3) and spec — matches Donut requirement.
