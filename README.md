# SISVAN · Caracterización — de Epi Info 7 a la web (online + offline)

Aplicación web que reemplaza las "hojas" de Epi Info 7 para las caracterizaciones SISVAN de la Subred Sur.
Base migrada en esta versión: **Menores de 5 años** (vista `AltNutMen5` del proyecto `FormulariosCaracterizacionSISVAN.prj`).
Las otras cuatro (recién nacidos, gestantes, adultos, BAC) se agregan con el mismo procedimiento (ver al final).

Autor: Alejandro Ortega — Subred Sur · SISVAN.

## Qué hace (equivalencias con Epi Info)

| Epi Info 7 | Esta app |
|---|---|
| `.prj` + `.mdb` (metaFields, metaPages, code tables) | `src/forms/menores5/schema.json` + `codes.json`, generados con `scripts/build-schema.py` |
| 4 páginas del formulario (`metaPages`) | 4 "hojas" con las mismas 14 secciones numeradas y los mismos cuadros de grupo |
| Valores legales / Comment Legal / Option | `select`, radios, y campos con búsqueda para listas largas (UPGD, UPZ, pueblos indígenas) |
| Required, RANGE, Read Only, Repeat Last, patrón `##.#` | validación al guardar, campos calculados bloqueados, arrastre del último registro, `step` numérico |
| Check Code (`metaViews.CheckCode`) | `src/forms/menores5/rules.ts` — traducción 1:1: edad en meses, FIES, IMC, z-scores OMS, PB, IMC adulto, cintura, HIDE/UNHIDE, DIALOG |
| `ZSCORE("WHO CGS", …)` | `src/core/who/zscore.ts` con las tablas LMS OMS 2006 (0–60 meses) incluidas en `tables.json` |
| Tabla `AltNutMen5` + `AltNutMen51…54` (Access) | Un registro plano en IndexedDB (Dexie) por dispositivo + Firestore como base compartida |
| `GlobalRecordId`, `UniqueKey`, `RecStatus` | Se conservan con el mismo significado (GUID, consecutivo, 1 activo / 0 eliminado) |
| Exportar a Excel | `Exportar Excel` produce exactamente las 182 columnas y el orden de `resultado.xlsx` |
| Importar base histórica | `Importar Excel` lee un archivo con esa misma estructura y recalcula las reglas |

### Online / offline
* Todo se guarda **primero en el dispositivo** (IndexedDB). Sin señal se puede seguir digitando, editando y exportando.
* La app es PWA (`vite-plugin-pwa`): se instala en el teléfono/portátil y abre sin conexión.
* Con conexión y sesión iniciada, cada registro pendiente se **sube a Firestore** (`registros/menores5/items/{GlobalRecordId}`)
  y se **bajan** los cambios de otros dispositivos. Regla de conflicto: gana la última edición (`updatedAt`).
* Si no configuras Firebase (variables `VITE_FIREBASE_*` vacías) la app funciona 100 % local, igual que Epi Info en un PC.

## Estructura

```
sisvan-caracterizacion/
├─ index.html · metadata.json · vite.config.ts · package.json · .env.example · firestore.rules
├─ data/                       fuentes Epi Info (prj, mdb, diccionario, resultado.xlsx)
├─ scripts/build-schema.py     genera schema/codes/columns desde el .mdb  ← reusar para las otras 4 bases
├─ public/icon.svg
└─ src/
   ├─ main.tsx · App.tsx · styles.css
   ├─ core/
   │  ├─ types.ts              tipos de campo, registro, definición de base
   │  ├─ db.ts                 IndexedDB (Dexie): registros, consecutivo, borrado lógico
   │  ├─ firebase.ts · sync.ts Firestore + Google Sign-In, push/pull de pendientes
   │  ├─ exportExcel.ts        SheetJS: exportar (estructura resultado.xlsx) e importar
   │  └─ who/zscore.ts · tables.json   LMS OMS, interpolación, restricción ±3 SD
   ├─ forms/
   │  ├─ registry.ts           las 5 bases (una activa, cuatro pendientes)
   │  └─ menores5/
   │     ├─ schema.json · codes.json · columns.json · checkcode.txt   (generados)
   │     ├─ rules.ts           check code traducido
   │     └─ index.ts           ensambla la FormDefinition
   ├─ ui/  FormRenderer.tsx · Field.tsx · RecordList.tsx
   └─ hooks/useOnline.ts
```

## Cómo montarlo en Google AI Studio (Build → My apps)

1. En AI Studio → **Build** → nueva app (React + TypeScript). Abre el editor de código.
2. Reemplaza el contenido del proyecto con esta carpeta (`index.html`, `metadata.json`, `package.json`, `vite.config.ts`, `tsconfig.json`, `src/`, `public/`).
   Si el editor no permite subir carpetas, súbelo primero a un repositorio de GitHub e impórtalo desde ahí; la app es un proyecto Vite estándar, así que también corre en Firebase Hosting, GitHub Pages o cualquier hosting estático (`npm run build` → `dist/`).
3. Dependencias (ya están en `package.json`): `react`, `react-dom`, `dexie`, `dexie-react-hooks`, `firebase`, `xlsx`, `vite-plugin-pwa`.
4. **Firebase (para la parte online):**
   1. Crea un proyecto en console.firebase.google.com → habilita **Firestore** y **Authentication → Google**.
   2. En "Configuración del proyecto → Tus apps → Web" copia las claves y pégalas en `.env` (copiando `.env.example`).
      En AI Studio se cargan como *secrets/variables de entorno* con los mismos nombres `VITE_FIREBASE_*`.
   3. Publica `firestore.rules` (ajusta los dominios de correo permitidos). **Importante:** los registros contienen datos personales de menores; no dejes reglas abiertas.
   4. Si el inicio de sesión con ventana emergente falla dentro del iframe de AI Studio, cambia `signInWithPopup` por `signInWithRedirect` en `src/core/firebase.ts`.
5. Local: `npm install` → `npm run dev`. Producción: `npm run build`.

## Decisiones que conviene conocer al validar contra la base vieja

* **Sexo12** se guarda como `1` / `2` (Comment Legal: se muestra "1-Masculino", se guarda el código), igual que Epi Info.
* **Campos Option** (`Cuantoinviertealimentacion`, `Nivelingresosfamiliares`, `EntidadalaqueseCanaliz`) se guardan como índice 0-based de la opción, como hace Epi Info 7.
* **Fechas** se guardan como texto `YYYY-MM-DD`. Al exportar quedan como texto; si prefieres celdas de fecha, cámbialo en `exportExcel.ts`.
* **Valores legales** se guardan sin espacios al final (Epi Info trae p. ej. `"5. Otro   "`); las comparaciones del check code se hacen con el valor recortado.
* **Z-score P/T**: `ZSCORE_MODE = 'epiinfo'` en `rules.ts` reproduce el check code al detalle (suma 0.7 cm desde los 24 meses y usa la tabla peso/longitud hasta 109.3 cm; por encima usa las filas "quemadas" de peso/talla sin interpolar). Con `'who'` se usa el criterio OMS puro (peso/talla desde 24 meses). Verificado: los tres tramos de prueba dan el mismo z que las fórmulas del check code.
* Los z-scores por edad (T/E, IMC/E, PC/E) interpolan linealmente las tablas mensuales OMS; la diferencia frente a las tablas diarias que usa Epi Info es < 0.02 SD.
* **Mirror, Label, Group y Command Button** no se almacenan ni se exportan (tampoco lo hace Epi Info). `TALLALONGITUD2` sí se almacena y va oculto, igual que allá.
* `EdadMeses = ((visita − nacimiento) + 1) / 30.44`, redondeado a 1 decimal como el patrón `##.#`.

## Agregar las otras cuatro bases

1. Copia el `.mdb`/`.prj` de la base en `data/`.
2. Genera el esquema (una vez por vista):
   ```bash
   pip install access-parser openpyxl
   python3 scripts/build-schema.py --mdb data/OtraBase.mdb --view NombreDeLaVista --resultado data/resultado_otra.xlsx --out src/forms/gestantes
   ```
3. Traduce `src/forms/gestantes/checkcode.txt` a `rules.ts` siguiendo el de menores de 5 (mismas tres funciones: `applyRules`, `hiddenFields`, `warnings`).
4. Crea `src/forms/gestantes/index.ts` (copiar el de menores5, cambiar `id`, títulos y `titleField`) y añádelo a `forms` en `src/forms/registry.ts`.
   La app la muestra en el menú de bases, con su propia colección en Firestore y su propio Excel.
