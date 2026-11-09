# Rutinas compartibles, importación con IA y curaduría del catálogo — diseño

**Fecha:** 31-oct-2026 · **Estado:** aprobado por el dueño del producto (pendiente revisión del spec escrito)

## Problema

Cargar rutinas a mano da pereza: la gente las tiene en notas, en un mensaje del profe o en otra app. Además no hay forma de pasarse rutinas entre amigos, y los ejercicios que crea cada usuario quedan sueltos sin mejorar el catálogo.

## Objetivos

1. Pasarse rutinas por WhatsApp con un **texto legible** que El Bravo sabe leer y escribir.
2. **Rutinas públicas** en el perfil que cualquiera puede ver y copiar.
3. **Importar una rutina en cualquier formato** con una LLM, que también crea los ejercicios que faltan.
4. Que el equipo de El Bravo **cure el catálogo** a partir de los ejercicios creados por usuarios, con ayuda de una LLM.

## Decisiones tomadas

| # | Decisión | Elegido |
|---|---|---|
| R1 | Proveedor de LLM | **OpenAI** con la key del dueño (`OPENAI_API_KEY`, recomendado: key propia del proyecto con límite mensual). Modelo configurable por `OPENAI_MODEL` (por defecto un modelo chico con salida estructurada). |
| R2 | Visibilidad de rutinas | **Privada** (por defecto) / **Pública** (en el perfil; cualquier usuario logueado la ve y la copia). |
| R3 | Ejercicios propios al copiar | **Se copian** al que copia (privados suyos); si ya tiene uno con el mismo nombre normalizado, se reusa. |
| R4 | Ejercicios que la LLM no encuentra | **Se crean automáticamente** (privados, marcados "creado con IA") con músculos, equipamiento y tipo propuestos por la LLM; el usuario los revisa antes de guardar. |
| R5 | Admins del catálogo | Variable `ADMIN_EMAILS` (lista separada por comas). Sin roles en la DB. |
| R6 | Análisis de curaduría | **A pedido** (botón), no automático: la LLM sugiere, el admin decide. |

Fuera de alcance (por ahora): nivel de visibilidad "solo amigos", likes/rankings de rutinas, edición colaborativa.

---

## Fase 1 — Formato de texto El Bravo

### Formato

```
🏋️ Pecho y espalda
Notas: llegar al fallo en la última serie

Press de banca — 4×8 @ 60 kg · desc 90s
Remo con barra — 10 @ 50 kg, 8 @ 55 kg, 6 @ 60 kg
Plancha — 3×45s
Dominadas — 3×máx
Remo en máquina Hammer — 3×12

Hecho con El Bravo · https://elbravo.vercel.app/routines/<id>
```

- Línea 1: nombre (emoji opcional, se ignora al leer). `Notas:` opcional.
- Una línea por ejercicio: `Nombre — series[ · desc Ns]`.
- Series: `N×reps[ @ kg]` (todas iguales), `N×Ns` (por tiempo; también `N×1:30`), `N×máx` (sin reps fijas), o lista `reps @ kg, reps @ kg, …` (distintas).
- Tipos de serie opcionales con prefijo: `W` calentamiento, `D` drop, `F` al fallo (`W 12 @ 20 kg, 10 @ 40 kg…`).
- Pie con link solo si la rutina es pública. Las líneas que no son ejercicios (pie, vacías) se ignoran.

### Lector tolerante (sin LLM)
Acepta `x`/`X`/`×`/`*`, `-`/`—`/`:` como separador, coma o punto decimal, `kg`/`kgs`/nada, `seg`/`s`/`"`, mayúsculas/acentos indistintos. Devuelve `{ name, notes, exercises: [{ name, restSeconds, sets: [{ kind, reps, durationSeconds, weightKg }] }], unparsedLines }`. Si tiene al menos un ejercicio válido y casi ninguna línea sin entender, es "formato El Bravo".

### Datos
- `Exercise.name` deja de ser `@unique` global → `@@unique([createdByUserId, name])` (la importación crea ejercicios propios y no puede chocar con los de otros usuarios). MySQL permite varios `NULL`: la unicidad del **catálogo oficial** se valida en código (seed y promoción). `slug` sigue único global; los propios llevan sufijo aleatorio.

### Componentes
- `src/features/routines-share/format.ts` (puro): `routineToText(routine, { url? })`, `parseRoutineText(text)`, `looksLikeBravoFormat(parsed)`.
- `src/features/routines-share/match.ts` (puro): asocia cada nombre a un ejercicio visible para el usuario (exacto normalizado → alias → `searchExercises` con umbral alto) o lo marca **nuevo**.
- UI: botón **Compartir** en cada rutina (`navigator.share` con el texto; si no hay, copiar al portapapeles). Pantalla **Rutinas → Importar** (`/routines/import`): pegar texto → revisión → editor.

### Pantalla de revisión (compartida con la fase 3)
Lista los ejercicios: ✓ **encontrado** ("Press de banca") o ✨ **nuevo**. Cada uno permite cambiar a qué ejercicio corresponde (buscador del catálogo) o renombrar. En la fase 1, un ejercicio nuevo se crea con nombre, tipo inferido (reps/tiempo) y músculos vacíos (el usuario puede completarlos con el editor de músculos existente). Al confirmar abre el editor de rutinas existente con el borrador; **los ejercicios nuevos se crean recién al guardar la rutina**, en la misma transacción.

---

## Fase 2 — Rutinas públicas y copiar

### Datos
- `Routine.visibility` enum `private | public` (default `private`).
- `Routine.copiedFromRoutineId String?` (FK `SetNull`) y `copiedFromUserName String?` (snapshot para mostrar "Basada en la rutina de Juan" aunque el original se borre).

### Flujos
- **Editor de rutina:** selector Privada/Pública.
- **Perfil (`/u/[id]` y propio):** sección "Rutinas" con las públicas (en el propio, todas con etiqueta).
- **Ver rutina ajena** (`/routines/[id]` en modo lectura, solo si es pública; si es privada → 404, no 403): ejercicios y series, autor, **Copiar a mis rutinas**, **Compartir**.
- **Copiar:** crea una rutina privada del que copia con todos los ejercicios y series. Ejercicios del catálogo se referencian; ejercicios propios del autor se **duplican** como privados del que copia (con músculos, equipamiento, tipo, descripción), o se reusa uno suyo con el mismo nombre normalizado. Todo en una transacción.

### Seguridad
Toda lectura de rutina ajena pasa por `visibility = public`; las acciones de editar/borrar siguen exigiendo dueño. Test de IDOR (ver/copiar privada de otro → no encontrado).

---

## Fase 3 — Importar con IA (cualquier formato)

### Flujo
1. En `/routines/import` el texto pegado se intenta leer como formato El Bravo (fase 1). Si alcanza, no se llama a la LLM.
2. Si no, `importRoutineWithAiAction(text)` → `src/server/ai/routine-import.ts`:
   - Prompt con: el texto, la lista de **nombres** de ejercicios visibles para el usuario (catálogo + propios, ~100–200 líneas), y las reglas del formato.
   - **Salida estructurada** (JSON Schema estricto): `{ name, notes, exercises: [{ name, catalogName | null, measureType, restSeconds, sets: [...], newExercise: { nameEn, equipment, muscles: [{ muscleSlug, percentage }] } | null }] }`.
   - Validación con Zod de la respuesta; `catalogName` se verifica contra el catálogo real (si la LLM inventa un nombre, se trata como nuevo). Los `muscleSlug` se validan contra los 15 músculos existentes; porcentajes normalizados a 100.
3. Misma pantalla de revisión (los nuevos muestran los músculos propuestos, editables) → editor → guardar crea los ejercicios (`createdByUserId` = usuario, `source = "ai"`).

### Límites y errores
- `rateLimit` por usuario: 20 importaciones con IA por día; texto ≤ 8.000 caracteres; timeout 30 s.
- Sin `OPENAI_API_KEY`: el botón de IA no aparece; solo se acepta formato El Bravo.
- Error de OpenAI / respuesta inválida: mensaje claro, el texto pegado se conserva, se puede reintentar.
- Privacidad: el texto pegado y los nombres de los ejercicios del usuario se envían a OpenAI (se aclara en la pantalla). No se guarda el texto en la DB.

### Datos
- `Exercise.source` enum `catalog | user | ai` (default `user`; seed → `catalog`).

### Componentes
- `src/server/ai/openai.ts`: cliente mínimo (`fetch` a la API de OpenAI, sin SDK), con timeout y `response_format` de JSON Schema. Inyectable para tests.
- `src/server/ai/routine-import.ts`: prompt, schema, validación y mapeo a borrador.

---

## Fase 3b — Importar desde archivos (fotos, PDF, Word, Excel, texto)

Decidido con el dueño (9-nov-2026): además de pegar texto, en `/routines/import` se pueden **adjuntar archivos**. Mismo flujo después: revisión → editor → guardar.

| Tipo | Cómo se lee |
|---|---|
| Fotos / capturas (JPG, PNG, HEIC/foto del celu, WebP) — **hasta 4 por importación** | En el navegador se achican (lado mayor ≤ 1600 px, JPEG) y van a la IA como imágenes. |
| PDF (≤ 10 páginas) | Va a la IA como archivo (sirve aunque sea escaneado). |
| Word (.docx), Excel (.xlsx), texto (.txt, .csv) | Se extrae el texto **en el navegador** y sigue el flujo de texto (formato El Bravo sin IA; si no, IA de texto). |

- Una importación = **un** cupo del límite diario (20/día), tenga 1 o 4 archivos.
- Tamaño total que viaja al servidor ≤ 4 MB (límite de Vercel 4,5 MB); se avisa claro si se pasa.
- **Privacidad:** los archivos no se guardan (ni en la base ni en R2): se procesan en memoria y se mandan a OpenAI; el aviso de privacidad lo dice.
- Mezclar: o archivos o texto pegado en una misma importación (si hay archivos con texto extraído, se junta en un único texto).
- Sin `OPENAI_API_KEY`: solo se aceptan los archivos de texto (docx/xlsx/txt/csv) en formato El Bravo; fotos y PDF no aparecen.
- Timeout de la IA para archivos: 45 s (la página ya tiene `maxDuration = 60`).

---

## Fase 4 — Curaduría del catálogo

### Acceso
`src/server/auth/admin.ts`: `isAdmin(user)` por `ADMIN_EMAILS`. Página `/admin/ejercicios` y sus acciones exigen admin (404 si no).

### Pantalla
- Ejercicios con `createdByUserId != null`, **agrupados por nombre normalizado + parecido** (`normalize` + distancia ≤ 1 + alias), ordenados por uso: cantidad de usuarios, rutinas y entrenamientos que los usan.
- Por grupo: nombres, creadores, si fueron con IA, uso.
- **Analizar con IA** (por grupo o "los 20 más usados"): la LLM devuelve una de: `promote` (nombre canónico, nameEn, músculos con %, equipamiento, tipo, 3–5 pasos), `alias_of` (nombre exacto del catálogo) o `skip` (motivo). Se guarda la sugerencia para no repetir el gasto (`ExerciseCurationSuggestion`, invalidada si cambia el grupo).

### Acciones del admin (la IA nunca aplica nada sola)
- **Promover:** crea el ejercicio oficial (`createdByUserId = null`, `source = catalog`, textos con `reviewed: false`) con los datos editados por el admin; **fusiona** los propios del grupo: reasigna `RoutineExercise` y `ActivityExercise` al oficial, mueve alias, borra los propios; recalcula insignias de los afectados (los puntos de temporada no dependen del ejercicio); notifica a los creadores (`NotificationType.exercise_promoted`: "Tu ejercicio «X» ahora es parte del catálogo").
- **Sinónimo de X:** agrega los nombres como `ExerciseAlias` de X y fusiona igual.
- **Ignorar:** `Exercise.curationStatus = ignored` en los del grupo; vuelve a aparecer si su uso crece (más usuarios).
- Todo en transacción; acción idempotente.

---

## Pruebas

| Nivel | Qué |
|---|---|
| Unit | Lector/escritor del formato (ida y vuelta, entradas desprolijas reales); `match` (exacto, alias, typo, nuevo); validación de la respuesta de la LLM (fixtures, incluidas respuestas inválidas); agrupamiento de curaduría. |
| Integración | Guardar una importación crea ejercicios en la misma transacción; copiar rutina con ejercicios ajenos (duplica / reusa); privada de otro no se ve ni se copia; promover/alias fusiona rutinas e historial, borra propios, notifica; no-admin no accede. El cliente de OpenAI se simula. |
| E2E | Pegar texto El Bravo → revisar → guardar; rutina pública en un perfil → copiar; compartir genera el texto. (La IA no se llama en E2E.) |

## Orden de entrega
Cada fase se publica sola: 1 → 2 → 3 → 4. Las fases 3 y 4 necesitan `OPENAI_API_KEY` en Vercel (y la 4, `ADMIN_EMAILS`).

## Migraciones
- Fase 1: unicidad de `Exercise.name` por dueño.
- Fase 2: `Routine.visibility`, `copiedFromRoutineId`, `copiedFromUserName`.
- Fase 3: `Exercise.source`.
- Fase 4: `Exercise.curationStatus`, `ExerciseCurationSuggestion`, `NotificationType.exercise_promoted`.
Todas aditivas o compatibles con el código publicado (se aplican antes del push, como hasta ahora). Nombres de tabla en PascalCase en el SQL.
