# Daily Training — Diseño

**Fecha:** 2026-09-17
**Autor:** Eloi (con Claude)
**Estado:** aprobado para pasar a plan de implementación

## Contexto y objetivo

Eloi es senior 2 en auditoría en Deloitte Ginebra (4 años de experiencia). Quiere una rutina diaria de ~15 minutos (3 bloques de ~5 min) para entrenar tres competencias en paralelo:

1. **Contabilidad/auditoría** — mapear qué norma (IFRS/IAS, Swiss GAAP FER, PCAOB/ISA) aplica a cada partida o situación, más que memorizar cláusulas exactas.
2. **Francés** — nivel de gramática inicial; presente ya dominado, floja en todo lo demás (pasado, futuro, subjuntivo...).
3. **Inglés de trabajo** — ya tiene buen nivel; quiere pulir matices casi nativos, vocabulario/idioms de finanzas-auditoría, y escritura profesional (emails/informes).

Debe poder hacerlo cada mañana desde el móvil, los 3 bloques seguidos, sin coste de dinero.

## Decisiones de diseño (y por qué)

| Decisión | Elegido | Por qué |
|---|---|---|
| Coste | Cero — sin llamadas a ninguna API de pago | Requisito explícito del usuario tras ver que "móvil + web + 3 bloques seguidos" con IA en vivo tendría un coste (~2-6€/mes) |
| Motor de preguntas | Contenido 100% estático (pre-escrito), no IA en tiempo de uso | Única forma de tener móvil + web + flujo continuo + coste cero a la vez |
| Hosting | Cloudflare Pages (capa gratuita) | Mismo stack que ya usa en Unobis, URL estable para acceder desde el móvil |
| Progreso | `localStorage` del navegador, con export/import JSON manual como backup | Sin backend no hay dónde escribir un fichero persistente; localStorage es gratis y suficiente para un solo dispositivo. El export/import cubre el caso de cambio de móvil sin montar sync real |
| Contabilidad — formato | Mezcla: casos comparativos entre normativas (lun/mié/vie) + quiz rápido (mar/jue) | Decisión explícita del usuario |
| Contabilidad — alcance | Incluye normas contables (IFRS/IAS/Swiss GAAP FER) Y normas de auditoría (PCAOB/ISA) desde el inicio | Decisión explícita del usuario tras aclarar que PCAOB es auditoría, no contabilidad |
| Contabilidad — fuentes | Investigación en fuentes oficiales (IFRS Foundation, PCAOB, textos Swiss GAAP FER), cada pregunta cita norma/párrafo | Requisito de fiabilidad al 100% del usuario |
| Francés — progresión | Escalera fija de bloques gramaticales, avanza tras 3 sesiones seguidas correctas en el bloque actual | Decisión explícita del usuario |
| Francés — orden de arranque | Empieza en **passé composé** (salta presente, ya dominado) | Aclarado explícitamente por el usuario |
| Inglés — foco | Corrección de matices casi nativos + vocabulario/idioms de finanzas-auditoría + escritura profesional (sin roleplay) | Selección explícita del usuario |

## Arquitectura

Sitio estático puro, sin backend, sin build tools.

```
daily-training/
├── index.html              ← página única: los 3 bloques, uno detrás de otro
├── styles.css
├── script.js                ← lógica de progresión + localStorage + export/import
├── manifest.json             ← PWA manifest ("Añadir a pantalla de inicio")
├── data/
│   ├── accounting-bank.json  ← banco de preguntas (contabilidad + auditoría, con fuente citada)
│   ├── french-ladder.json    ← escalera de bloques gramaticales franceses
│   └── english-bank.json     ← ejercicios de matices / vocab-idioms / escritura
└── docs/superpowers/specs/   ← este documento y futuros
```

Desplegado en Cloudflare Pages bajo un proyecto propio (ej. `daily-training.pages.dev`), añadido a pantalla de inicio del móvil vía el manifest para que se sienta como una app.

## Modelo de datos

**`accounting-bank.json`** — array de preguntas:
```json
{
  "id": "acc-0001",
  "type": "case" | "quiz",
  "topic": "revenue-recognition",
  "frameworks": ["IFRS", "SwissGAAP-FER", "PCAOB"],
  "prompt": "...",
  "options": [{"label": "...", "correct": true}, ...],
  "explanation": "...",
  "source": "IFRS 15 §22; FER 3"
}
```

**`french-ladder.json`** — array ordenado de bloques:
```json
{
  "id": "passe-compose",
  "order": 1,
  "name": "Passé composé",
  "masteryThreshold": 3,
  "exercises": [
    {"id": "pc-01", "type": "mcq" | "fill-blank" | "error-spot" | "production",
     "prompt": "...", "correctAnswer": "...", "explanation": "..."}
  ]
}
```

**`english-bank.json`** — array de ejercicios:
```json
{
  "id": "en-0001",
  "focus": "nuance" | "vocab-idioms" | "writing",
  "type": "mcq" | "rewrite",
  "prompt": "...",
  "modelAnswer": "...",
  "explanation": "..."
}
```

**Progreso (en `localStorage`, no en disco):**
```json
{
  "streakDays": 12,
  "lastCompletedDate": "2026-09-17",
  "accounting": {"recentIds": ["acc-0031", "acc-0007", ...]},
  "french": {"currentBlockId": "passe-compose", "consecutiveCorrect": 2, "recentExerciseIds": [...]},
  "english": {"lastFocus": "writing", "recentIds": [...]}
}
```

## Lógica de progresión por bloque

- **Contabilidad:** según el día de la semana (fecha local del dispositivo) se elige `case` (lun/mié/vie) o `quiz` (mar/jue); se descarta cualquier pregunta vista en las últimas ~15 sesiones (`recentIds`) para minimizar repetición.
- **Francés:** se muestra un ejercicio del bloque actual (`currentBlockId`). Si el usuario marca acierto (autocorrección en mcq/fill-blank/error-spot, autoevaluación en production) sube `consecutiveCorrect`; al llegar a `masteryThreshold` (3) avanza al siguiente bloque de la escalera y resetea el contador. Si falla, resetea `consecutiveCorrect` a 0 (se queda más días en el bloque).
- **Inglés:** rota entre los tres focos (`nuance`, `vocab-idioms`, `writing`) evitando repetir el mismo foco que el día anterior; dentro del foco elegido, evita ejercicios vistos recientemente.

## Flujo de uso (móvil)

1. Abre la URL (o el icono de pantalla de inicio) por la mañana.
2. Ve la racha actual y el Bloque 1 — Contabilidad. Responde, ve feedback inmediato + explicación + fuente citada. Pulsa "Siguiente".
3. Bloque 2 — Francés, ejercicio del nivel actual. Mismo patrón.
4. Bloque 3 — Inglés. Mismo patrón.
5. Pantalla final "¡Hecho por hoy!" — se actualiza la racha y el progreso en `localStorage`.

Botón discreto de "Exportar progreso" / "Importar progreso" (descarga/sube un JSON) por si cambia de móvil.

## Alcance de contenido inicial

Dado que es 100% estático, el banco debe tener suficiente variedad para no repetirse demasiado pronto. Alcance inicial propuesto (a construir en la fase de implementación):

- **Contabilidad:** ~50-60 preguntas cubriendo las partidas más comunes del balance/PyG (PP&E, intangibles, inventario, instrumentos financieros, activos mantenidos para la venta, arrendamientos, ingresos, provisiones, combinaciones de negocio, consolidación, deterioro, impuestos, valor razonable) más una selección de normas de auditoría (PCAOB/ISA) sobre áreas de riesgo habituales. Todas investigadas en fuentes oficiales con cita.
- **Francés:** primeros 4-5 bloques de la escalera (passé composé, imparfait, plus-que-parfait, futur, subjonctif présent), ~10 ejercicios por bloque.
- **Inglés:** ~30-40 ejercicios repartidos entre los tres focos, con sabor de auditoría/finanzas donde tenga sentido.

**Mantenimiento futuro (fuera de alcance de esta fase):** cuando el banco empiece a sentirse repetitivo, Eloi puede pedir en una sesión de Claude Code que se amplíe — no se construye ningún sistema automático de "recarga" en esta v1 (YAGNI).

## Criterios de éxito

- La web carga en el móvil (vía la URL de Cloudflare Pages) y completa los 3 bloques seguidos sin salir de la página.
- El progreso persiste al cerrar y reabrir el navegador (localStorage).
- La escalera de francés avanza de bloque solo tras 3 sesiones seguidas correctas, y retrocede el contador (no el bloque) tras un fallo.
- La rotación de contabilidad (caso/quiz) sigue el día de la semana correctamente.
- Cada pregunta de contabilidad lleva una fuente verificable (norma + párrafo).
- Exportar/importar progreso funciona (descarga y recarga un JSON válido).

**URL desplegada:** https://daily-training-6l9.pages.dev (Cloudflare Pages, cuenta Unobis — proyecto `daily-training`, desplegado 2026-09-17 a petición explícita del usuario tras confirmar que el token disponible era el de la cuenta de Unobis).
