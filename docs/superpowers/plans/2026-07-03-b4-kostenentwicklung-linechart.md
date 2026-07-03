# B4 Kostenentwicklung Line Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an OVP analytical line-chart card showing daily accumulated B4
("Zahlungen") values for 2024–today, filterable by year through the Overview
Page's existing global SmartFilterBar.

**Architecture:** SAP Fiori Overview Page (`sap.ovp`), OData V2 local
mock service. A new `B4Zahlung`/`B4Zahlungen` entity (Datum, Jahr, B4) carries
915 daily rows of deterministic test data. A `UI.Chart` annotation
(`ChartType/Line`) drives a new `sap.ovp.cards.charts.analytical` card. The
year filter is NOT card-local — a `Jahr` property is added to both
`B4Zahlung` and the existing `VertragStatistik` entity so OVP's cross-card
property-name-matching applies the global filter's `Jahr` selection to both
cards automatically.

**Tech Stack:** SAPUI5 1.96.49, `sap.ovp` floorplan, OData V2 (CSDL
`metadata.xml` + separate `UI` vocabulary `annotation.xml`), local JSON mock
data served via `@sap-ux/ui5-middleware-fe-mockserver`, Node.js (for one-off
deterministic test-data generation only, not shipped in the app).

## Global Constraints

- Project root for all file paths below: `c:/Dev/ui5/overviewpage/opexample/`
- OData version: 2.0 (do not use V4 annotation/template syntax)
- Follow existing naming/indentation conventions in `metadata.xml` /
  `annotation.xml` (4-space indent, German field labels)
- Card template family already in use: `sap.ovp.cards.charts.analytical`
  (not the V4 `sap.ovp.cards.v4.*` templates)
- Test-data start value: `19655.76` on `2024-01-01`; daily growth factor
  randomly in `[0.001, 0.002)`; end date `2026-07-03`; values rounded to 2
  decimals
- No automated test runner exists in this project (no QUnit/OPA5/Jest
  configured) — verification steps use JSON/XML syntax validation plus a
  manual smoke test via `npm run start-mock`, per the approved spec at
  `docs/superpowers/specs/2026-07-03-b4-kostenentwicklung-linechart-design.md`

---

### Task 1: Extend `metadata.xml` with the `B4Zahlung` entity and `Jahr` on `VertragStatistik`

**Files:**
- Modify: `webapp/localService/mainService/metadata.xml`

**Interfaces:**
- Produces: EntityType `com.example.vertrag.B4Zahlung` (properties `Datum`
  Edm.DateTime key/dimension, `Jahr` Edm.String dimension, `B4` Edm.Decimal
  measure) and EntitySet `B4Zahlungen`; adds `Jahr` (Edm.String, nullable)
  to EntityType `com.example.vertrag.VertragStatistik`. Later tasks
  (mock data, annotations, manifest card) depend on these exact names.

- [ ] **Step 1: Add `Jahr` property to `VertragStatistik`**

Edit `webapp/localService/mainService/metadata.xml`, inside the
`VertragStatistik` EntityType:

```xml
            <EntityType Name="VertragStatistik">
                <Key>
                    <PropertyRef Name="Status"/>
                </Key>
                <Property Name="Status" Type="Edm.String" MaxLength="20" Nullable="false"/>
                <Property Name="Anzahl" Type="Edm.Int32" Nullable="false"/>
                <Property Name="Created" Type="Edm.DateTime" Nullable="true"/>
                <Property Name="Jahr" Type="Edm.String" MaxLength="4" Nullable="true" sap:label="Jahr"/>
            </EntityType>
```

(Only the new `Jahr` line is added, directly before `</EntityType>`.)

- [ ] **Step 2: Add the `B4Zahlung` EntityType**

Insert a new EntityType directly after the `JahresWert` EntityType's closing
`</EntityType>` tag and before `<EntityContainer ...>`:

```xml
            <EntityType Name="B4Zahlung" sap:semantics="aggregate">
                <Key>
                    <PropertyRef Name="Datum"/>
                </Key>
                <Property Name="Datum" Type="Edm.DateTime" Nullable="false" sap:aggregation-role="dimension" sap:label="Datum"/>
                <Property Name="Jahr" Type="Edm.String" MaxLength="4" Nullable="false" sap:aggregation-role="dimension" sap:label="Jahr"/>
                <Property Name="B4" Type="Edm.Decimal" Precision="18" Scale="2" sap:aggregation-role="measure" sap:label="B4 Zahlungen (kumuliert)"/>
            </EntityType>
```

- [ ] **Step 3: Register the `B4Zahlungen` EntitySet**

In the same file, extend `EntityContainer`:

```xml
            <EntityContainer Name="Container" m:IsDefaultEntityContainer="true">
                <EntitySet Name="VertragStatistiken" EntityType="com.example.vertrag.VertragStatistik"/>
                <EntitySet Name="JahresWerte" EntityType="com.example.vertrag.JahresWert" sap:semantics="aggregate"/>
                <EntitySet Name="B4Zahlungen" EntityType="com.example.vertrag.B4Zahlung" sap:semantics="aggregate"/>
            </EntityContainer>
```

- [ ] **Step 4: Validate the XML is well-formed**

Run:
```bash
node -e "require('fs').readFileSync('webapp/localService/mainService/metadata.xml','utf8')" && echo "read OK"
```
Then validate structurally with PowerShell's XML parser (catches
well-formedness errors like unclosed tags):
```powershell
[xml](Get-Content "webapp/localService/mainService/metadata.xml" -Raw) | Out-Null
Write-Output "XML OK"
```
Expected: `XML OK` with no exception.

- [ ] **Step 5: Commit**

```bash
git add webapp/localService/mainService/metadata.xml
git commit -m "Add B4Zahlung entity and Jahr filter property to metadata"
```

---

### Task 2: Generate the `B4Zahlungen.json` test data

**Files:**
- Create (temporary, not committed): a Node script in the OS scratch
  directory, e.g. `C:\Users\info\AppData\Local\Temp\claude\...\scratchpad\generate-b4zahlungen.js`
- Create: `webapp/localService/mainService/data/B4Zahlungen.json`

**Interfaces:**
- Consumes: none
- Produces: `B4Zahlungen.json` — a JSON array of 915 objects, each shaped
  `{ "Datum": "/Date(<ms>)/", "Jahr": "2024"|"2025"|"2026", "B4": <number, 2 decimals> }`,
  matching the `B4Zahlung` EntityType from Task 1 and the `/Date(...)/`
  convention already used in `VertragStatistiken.json`'s `Created` field.

- [ ] **Step 1: Write the generator script**

Write to a scratch file (path above), replacing `<scratchpad>` with the
session's actual scratchpad directory:

```javascript
const fs = require('fs');
const path = require('path');

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);
const startDate = new Date(Date.UTC(2024, 0, 1));
const endDate = new Date(Date.UTC(2026, 6, 3));

let value = 19655.76;
const rows = [];
for (
  let d = new Date(startDate);
  d.getTime() <= endDate.getTime();
  d.setUTCDate(d.getUTCDate() + 1)
) {
  if (rows.length > 0) {
    const rate = 0.001 + rng() * 0.001;
    value = Math.round(value * (1 + rate) * 100) / 100;
  }
  rows.push({
    Datum: `/Date(${d.getTime()})/`,
    Jahr: String(d.getUTCFullYear()),
    B4: value
  });
}

const outPath = process.argv[2];
fs.writeFileSync(outPath, JSON.stringify(rows, null, 2) + '\n');
console.log(`Wrote ${rows.length} rows to ${outPath}`);
console.log('First:', rows[0]);
console.log('Last:', rows[rows.length - 1]);
```

- [ ] **Step 2: Run the script to generate the data file**

```bash
node "<scratchpad>/generate-b4zahlungen.js" "webapp/localService/mainService/data/B4Zahlungen.json"
```

Expected output: `Wrote 915 rows to webapp/localService/mainService/data/B4Zahlungen.json`,
`First: { Datum: '/Date(1704067200000)/', Jahr: '2024', B4: 19655.76 }`,
`Last:` an object with `Jahr: '2026'`.

- [ ] **Step 3: Validate the generated JSON and row count**

```bash
node -e "
const rows = JSON.parse(require('fs').readFileSync('webapp/localService/mainService/data/B4Zahlungen.json','utf8'));
console.log('count:', rows.length);
console.log('years:', [...new Set(rows.map(r => r.Jahr))].sort());
console.log('monotonic:', rows.every((r, i) => i === 0 || r.B4 >= rows[i-1].B4));
"
```
Expected: `count: 915`, `years: [ '2024', '2025', '2026' ]`,
`monotonic: true`.

- [ ] **Step 4: Commit**

```bash
git add webapp/localService/mainService/data/B4Zahlungen.json
git commit -m "Add generated B4Zahlungen daily test data (2024-01-01 to 2026-07-03)"
```

---

### Task 3: Add `Jahr` values to the existing `VertragStatistiken.json`

**Files:**
- Modify: `webapp/localService/mainService/data/VertragStatistiken.json`

**Interfaces:**
- Consumes: `Jahr` property added to `VertragStatistik` in Task 1
- Produces: value-help data for the global `Jahr` filter field (distinct
  values `2024`, `2025`, `2026` across the 3 rows)

- [ ] **Step 1: Add `Jahr` to each row**

Replace the full file content:

```json
[
  {
    "Status": "Geplant",
    "Anzahl": 100,
    "Created": "/Date(1783036800000)/",
    "Jahr": "2026"
  },
  {
    "Status": "In Vergabe",
    "Anzahl": 20,
    "Created": "/Date(1783036800000)/",
    "Jahr": "2025"
  },
  {
    "Status": "Beauftragt",
    "Anzahl": 200,
    "Created": "/Date(1783036800000)/",
    "Jahr": "2024"
  }
]
```

- [ ] **Step 2: Validate JSON syntax**

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync('webapp/localService/mainService/data/VertragStatistiken.json','utf8')).length)"
```
Expected: `3`

- [ ] **Step 3: Commit**

```bash
git add webapp/localService/mainService/data/VertragStatistiken.json
git commit -m "Add Jahr values to VertragStatistiken mock data for global filter"
```

---

### Task 4: Extend `annotation.xml` with the `UI.Chart` for `B4Zahlung` and the global `Jahr` filter field

**Files:**
- Modify: `webapp/annotations/annotation.xml`

**Interfaces:**
- Consumes: `com.example.vertrag.B4Zahlung` and its `Datum`/`B4` properties
  (Task 1); `com.example.vertrag.VertragStatistik.Jahr` (Task 1)
- Produces: `UI.Chart` annotation on `B4Zahlung` at annotation path
  `com.sap.vocabularies.UI.v1.Chart` (unqualified — consumed by the card's
  `chartAnnotationPath` in Task 5); `Jahr` added to `VertragStatistik`'s
  `UI.SelectionFields`

- [ ] **Step 1: Extend `UI.SelectionFields` on `VertragStatistik`**

```xml
            <Annotations Target="com.example.vertrag.VertragStatistik">
                <Annotation Term="UI.SelectionFields">
                    <Collection>
                        <PropertyPath>Status</PropertyPath>
                        <PropertyPath>Jahr</PropertyPath>
                    </Collection>
                </Annotation>
```

(Only the `<PropertyPath>Jahr</PropertyPath>` line is added.)

- [ ] **Step 2: Add the `UI.Chart` annotation for `B4Zahlung`**

Insert a new `Annotations` block directly after the closing
`</Annotations>` of the `JahresWert` target and before `</Schema>`:

```xml
            <Annotations Target="com.example.vertrag.B4Zahlung">
                <Annotation Term="UI.Chart">
                    <Record Type="UI.ChartDefinitionType">
                        <PropertyValue Property="Title" String="{i18n>b4KostenentwicklungCard_title}"/>
                        <PropertyValue Property="ChartType" EnumMember="UI.ChartType/Line"/>
                        <PropertyValue Property="Dimensions">
                            <Collection>
                                <PropertyPath>Datum</PropertyPath>
                            </Collection>
                        </PropertyValue>
                        <PropertyValue Property="Measures">
                            <Collection>
                                <PropertyPath>B4</PropertyPath>
                            </Collection>
                        </PropertyValue>
                    </Record>
                </Annotation>
            </Annotations>
```

- [ ] **Step 3: Validate XML well-formedness**

```powershell
[xml](Get-Content "webapp/annotations/annotation.xml" -Raw) | Out-Null
Write-Output "XML OK"
```
Expected: `XML OK` with no exception.

- [ ] **Step 4: Commit**

```bash
git add webapp/annotations/annotation.xml
git commit -m "Add Line chart annotation for B4Zahlung and extend global Jahr filter"
```

---

### Task 5: Register the card and add i18n texts

**Files:**
- Modify: `webapp/manifest.json`
- Modify: `webapp/i18n/i18n.properties`

**Interfaces:**
- Consumes: `entitySet: "B4Zahlungen"` and `chartAnnotationPath:
  "com.sap.vocabularies.UI.v1.Chart"` (Task 1 & 4)
- Produces: OVP card `b4KostenentwicklungCard` visible on the Overview Page

- [ ] **Step 1: Add the card to `sap.ovp.cards` in `manifest.json`**

Edit `webapp/manifest.json`, inside `sap.ovp.cards` (currently only
`vertragStatistikenCard`):

```json
    "cards": {
      "vertragStatistikenCard": {
        "model": "mainModel",
        "template": "sap.ovp.cards.list",
        "settings": {
          "title": "{{vertragStatistikenCard_title}}",
          "subTitle": "{{vertragStatistikenCard_subtitle}}",
          "entitySet": "VertragStatistiken",
          "sortBy": "Status",
          "sortOrder": "ascending",
          "listType": "condensed",
          "listFlavor": "standard",
          "annotationPath": "com.sap.vocabularies.UI.v1.LineItem"
        }
      },
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
    }
```

- [ ] **Step 2: Validate `manifest.json` syntax**

```bash
node -e "JSON.parse(require('fs').readFileSync('webapp/manifest.json','utf8')); console.log('JSON OK')"
```
Expected: `JSON OK`

- [ ] **Step 3: Add i18n texts**

Append to `webapp/i18n/i18n.properties`:

```properties

#XTIT: Title of the B4 cost development chart card
b4KostenentwicklungCard_title=B4 Kostenentwicklung

#YMSG: Subtitle of the B4 cost development chart card
b4KostenentwicklungCard_subtitle=Akkumulierte Zahlungen im Zeitverlauf
```

- [ ] **Step 4: Commit**

```bash
git add webapp/manifest.json webapp/i18n/i18n.properties
git commit -m "Register B4 Kostenentwicklung line chart card"
```

---

### Task 6: End-to-end manual verification

**Files:** none (verification only)

**Interfaces:**
- Consumes: everything from Tasks 1–5

- [ ] **Step 1: Start the app with mock data**

```bash
npm run start-mock
```
This runs `fiori run --config ./ui5-mock.yaml --open "test/flp.html#app-preview"`
and opens the app in the default browser.

- [ ] **Step 2: Verify the new card renders**

In the browser, confirm:
- A card titled "B4 Kostenentwicklung" with subtitle "Akkumulierte Zahlungen
  im Zeitverlauf" is visible on the Overview Page.
- It renders as a line chart with a single rising line (accumulated B4
  values), starting around 19,655.76 and ending noticeably higher.

- [ ] **Step 3: Verify the global `Jahr` filter**

In the Overview Page's global filter bar:
- Confirm a "Jahr" filter field is present alongside the existing "Status"
  field, offering values 2024, 2025, 2026.
- Select `Jahr = 2024` and apply. Confirm the "B4 Kostenentwicklung" line
  chart now shows only 2024 data (366 points, starting at 19,655.76).
- Confirm the existing "Vertragsstatistiken" list card also reduces to the
  single row with `Jahr = 2024` ("Beauftragt") — this is expected, since
  `Jahr` now exists on both entities and OVP applies matching filters to
  every card that has the property.
- Clear the filter and confirm both cards return to their unfiltered state.

- [ ] **Step 4: Run lint**

```bash
npm run lint
```
Expected: no new errors introduced by this change (pre-existing warnings, if
any, are out of scope).

- [ ] **Step 5: Report results**

No commit for this task — it is a verification-only checkpoint. If any
check in Steps 2–4 fails, stop and fix the relevant earlier task before
continuing.

---

## Self-Review Notes

- **Spec coverage:** Data model (Task 1), test data (Task 2), existing-data
  Jahr values (Task 3), chart annotation (Task 4), card registration + i18n
  (Task 5), global filter behavior + manual smoke test (Task 6) all map to
  spec sections. The out-of-scope donut chart and the removed
  `jahresWerteCard` are untouched by this plan, matching the spec's "Out of
  Scope" section.
- **Placeholder scan:** No TBD/TODO; all code blocks are complete and
  copy-pasteable.
- **Type/name consistency:** `B4Zahlung`/`B4Zahlungen`/`Datum`/`Jahr`/`B4`
  and `com.sap.vocabularies.UI.v1.Chart` (unqualified) are used identically
  across Tasks 1, 2, 4, and 5.
