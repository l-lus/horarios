# Arquitectura del Frontend — Horarios

**Última actualización:** 2026-10-25  
**Estado:** Arquitectura modularizada y saneada (47 módulos ES en `src/`, grafo 100% acíclico, cero violaciones de capa y suite de tests nativos en `tests/`).

---

## 1. Principios y restricciones de diseño

1. **Cero paso de build (Zero-Build):** El frontend se sirve tal cual está en el repositorio sobre GitHub Pages (o cualquier servidor HTTP estático local). No usa Webpack, Vite ni dependencias de `npm` en el cliente.
2. **ES Modules nativos (`import` / `export`):** El navegador carga [`src/main.js`](../src/main.js) mediante `<script type="module" src="src/main.js"></script>` y resuelve el grafo de módulos por HTTP/2.
3. **Grafo Acíclico Dirigido (DAG) y Capas Estrictas:** Ningún módulo importa de una capa superior ni forma ciclos de dependencia (`A → ... → A`). Esto está verificado automáticamente por [`tests/architecture.test.mjs`](../tests/architecture.test.mjs).
4. **CSP estricta (`script-src 'self'`):** Prohibido el uso de handlers inline (`onclick=...`), `eval` o scripts inline en [`index.html`](../index.html).
5. **Offline-first real (`sw.js`):** Todo archivo `.js`, `.css`, `.svg` o `.json` que forme parte de la app **debe** estar listado en `urlsToCache` dentro de [`sw.js`](../sw.js) para que la PWA funcione sin conexión.

---

## 2. Estructura de directorios

```text
horarios/
├── index.html                  # Documento principal (estructura DOM y carga de assets/módulos)
├── sw.js                       # Service Worker (en la raíz para tener scope sobre todo el proyecto)
├── README.md                   # Documentación general del proyecto
├── LICENSE                     # Licencia MIT
├── assets/                     # Recursos estáticos (sin lógica de negocio)
│   ├── manifest.json           # Web App Manifest (PWA)
│   ├── styles/                 # Hojas de estilo divididas en 5 capas de cascada
│   │   ├── tokens.css          # 1. Variables (:root), modo oscuro y 6 temas de color
│   │   ├── base.css            # 2. Reset, layout, .card, forms, botones, modales base y toast
│   │   ├── tarjetas-vistas.css     # 3. Fichaje/timer, estadísticas/progreso, histórico y calendario/popups
│   │   ├── modales-funciones.css # 4. Gist, configuración/toggles, perfiles, onboarding y drag & drop
│   │   └── responsivo-movimiento.css # 5. Keyframes, @media (hover/móvil/escritorio) y reduced-motion
│   └── icons/                  # Íconos de la app y del manifest (SVG y PNG)
├── src/                        # Código fuente en ES Modules (47 módulos)
│   ├── main.js                 # Punto de entrada (bootstrap de la aplicación)
│   ├── data/                   # Catálogos y datos estáticos puros
│   ├── core/                   # Utilidades transversales de bajo nivel (sin reglas de negocio ni UI)
│   ├── services/               # Estado de la aplicación, reglas de dominio y servicios externos
│   └── ui/                     # Componentes visuales, renderizado DOM, eventos y modales
├── tests/                      # Tests automatizados nativos (`node --test`, sin dependencias)
│   ├── architecture.test.mjs   # Valida capas, ausencia de ciclos, extensiones .js y precache de sw.js
│   └── domain.test.mjs         # Valida cálculos horarios, seguridad, compensatorios y arranque UI
├── docs/                       # Documentación técnica, seguridad y arquitectura
└── horarios-push/              # Backend opcional (Cloudflare Worker para Web Push y métricas anónimas)
```

---

## 3. Capas de la arquitectura y dirección de dependencias

La arquitectura se organiza en **4 capas más el punto de entrada (`main.js`)**. La regla fundamental es que **las capas inferiores jamás importan a las capas superiores**:

```text
┌──────────────────────────────────────────────────────────┐
│                      src/main.js                         │
│        (Bootstrap: inicializa OrquestadorUI y InstaladorPWA)    │
└────────────────────────────┬─────────────────────────────┘
                             │ importa
                             ▼
┌──────────────────────────────────────────────────────────┐
│                        src/ui/                           │
│   Renderizado DOM, listeners de eventos, modales,        │
│   animaciones, gráficos SVG y coordinación de vistas.    │
└──────────────┬────────────────────────────┬──────────────┘
               │ importa                    │ importa
               ▼                            │
┌──────────────────────────────────────┐    │
│            src/services/             │    │
│  Estado central (EstadoApp), cálculos │    │
│  de saldos/compensatorios, filtros,  │    │
│  perfiles, Gist, Push y Feriados.    │    │
└──────────────┬───────────────────────┘    │
               │ importa                    │
               ▼                            ▼
┌──────────────────────────────────────────────────────────┐
│                 src/core/   y   src/data/                │
│  Funciones puras de tiempo, sanitización, SHA-256,       │
│  bus de eventos (EventosApp), wrapper de localStorage,    │
│  helpers DOM básicos y catálogos estáticos.              │
└──────────────────────────────────────────────────────────┘
```

### Reglas por carpeta

| Carpeta | Rango de capa | Qué contiene | Qué puede importar | Qué **NO** debe hacer |
|---|---|---|---|---|
| `src/data/` | `0` | Constantes y catálogos estáticos (`FERIADOS_AR`, `FONDOS_SVG`). | Nada (módulos hoja). | No accede a `document`, `window` ni `localStorage`. |
| `src/core/` | `1` | Helpers de infraestructura base (`TiempoUtils`, `SeguridadYUtils`, `Almacenamiento`, `EventosApp`, `dom.js`, `movimiento.js`, `constantes.js`, `tema-inicial.js`). | Solo otros módulos de `src/core/` o `src/data/`. | No importa nada de `src/services/` ni `src/ui/`. |
| `src/services/` | `2` | Estado central (`EstadoApp`), lógica de dominio (`GestionDatos`, `Compensatorios`, `FiltrosYPeriodos`, `SaldoSemanal`, `TiposRegistro`, `GestorHistorial`), respaldos (`ImportarExportar`, `SincronizacionGist`), perfiles (`GestorPerfiles`), feriados (`FeriadosAR`) y avisos (`RecordatorioPush`, `InstaladorPWA`). | `src/core/`, `src/data/` y módulos inferiores de `src/services/` sin formar ciclos. | **Prohibido importar de `src/ui/`**. Toda comunicación hacia la UI pasa por `EstadoApp._notify()` o `EventosApp`. |
| `src/ui/` | `3` | Lectura de inputs, renderizado de tablas/tarjetas/calendario, modales, temas y animaciones. | `src/ui/` (sin ciclos), `src/services/`, `src/core/`, `src/data/`. | No escribe directamente en `localStorage` para datos de registros (usa `GestionDatos` o `Almacenamiento`). |
| `src/main.js` | `4` | Arranque en `DOMContentLoaded`. | `OrquestadorUI`, `InstaladorPWA`, `UsoTracker`, `FeriadosAR`. | No contiene lógica de negocio ni handlers extensos. |

---

## 4. Catálogo completo de módulos (`src/`)

### 4.1. Datos estáticos (`src/data/`)

| Archivo | Export | Responsabilidad |
|---|---|---|
| [`src/data/feriados.js`](../src/data/feriados.js) | `FERIADOS_AR` | Catálogo estático de feriados nacionales de Argentina por año. |
| [`src/data/fondos.js`](../src/data/fondos.js) | `FONDOS_SVG` | Catálogo de ilustraciones SVG decorativas para la tarjeta de fichaje. |

### 4.2. Núcleo transversal (`src/core/`)

| Archivo | Export | Responsabilidad |
|---|---|---|
| [`src/core/tema-inicial.js`](../src/core/tema-inicial.js) | *(script clásico en `<head>`)* | Aplica el tema oscuro y modo de animaciones (`horarios_temaOscuro`, `horarios_reducirAnimaciones` con fallback legado) antes del primer pintado (anti-FOUC) y protege contra clickjacking. |
| [`src/core/constantes.js`](../src/core/constantes.js) | `APP_STORAGE_PREFIX`, `STORAGE_KEYS`, `horasGte`, `horasEq` | Prefijo de aplicación (`horarios_`), claves de `localStorage`, comparadores de punto flotante con tolerancia y constantes globales. |
| [`src/core/dom.js`](../src/core/dom.js) | `$`, `setColapsable` | Acceso rápido por ID (`document.getElementById`) y helper de contenedores colapsables. |
| [`src/core/eventos.js`](../src/core/eventos.js) | `EventosApp` | Bus de eventos pub/sub (`on`, `off`, `emit`) y registro de handlers desacoplados (`register`, `call`). |
| [`src/core/movimiento.js`](../src/core/movimiento.js) | `Movimiento` | Detección de `prefers-reduced-motion` y helpers de transición. |
| [`src/core/seguridad.js`](../src/core/seguridad.js) | `SeguridadYUtils` | Sanitización de strings/notas, `escapeHtml`, `validarRegistroSeguro`, cálculo SHA-256 (`calcularHashSHA256` con fallback JS puro) y `reviverJSONSeguro`. |
| [`src/core/almacenamiento.js`](../src/core/almacenamiento.js) | `Almacenamiento` | Lectura/escritura segura en `localStorage` bajo el namespace `horarios_`, migración automática de claves legadas (`migrarClavesLegadas`), manejo de cuota y resolución de clave por perfil (`setProfileKeyResolver`). |
| [`src/core/tiempo-utils.js`](../src/core/tiempo-utils.js) | `TiempoUtils` | Aritmética de horas (`HH:MM` ↔ minutos), diferencia entre horarios, cruces de medianoche, formato de fechas ISO y rangos semanales. |

### 4.3. Servicios y dominio (`src/services/`)

| Archivo | Export | Responsabilidad |
|---|---|---|
| [`src/services/estado-app.js`](../src/services/estado-app.js) | `EstadoApp` | **Store central de dominio** (hoja en `services/`): mantiene `registros`, `diasHabiles`, `horasDiarias`, `historialDiasHabiles`, estado de edición/filtros, `calcularHoras` y canal `notify`. |
| [`src/services/gestion-datos.js`](../src/services/gestion-datos.js) | `GestionDatos` | Fachada de dominio: alta/baja/edición individual de fichajes, validación de formularios, sincronización con Push hoy y undo/redo. |
| [`src/services/compensatorios.js`](../src/services/compensatorios.js) | `Compensatorios` | Cálculo de banco de horas extras, asignación cronológica de horas a francos/compensatorios y tramos históricos de días hábiles. |
| [`src/services/filtros-periodos.js`](../src/services/filtros-periodos.js) | `FiltrosYPeriodos` | Filtrado de registros, cálculo de buffer por período, detección de jornada nocturna de ayer, edición de grupos y carga/borrado por rango. |
| [`src/services/importar-exportar.js`](../src/services/importar-exportar.js) | `ImportarExportar` | Serialización para exportación JSON, validación estructural, verificación SHA-256 y merge/reemplazo al importar respaldos. |
| [`src/services/saldo-semanal.js`](../src/services/saldo-semanal.js) | `SaldoSemanal` | Cálculo de saldos por semana y mes para las vistas de calendario, resumen y estadísticas. |
| [`src/services/tipos-registro.js`](../src/services/tipos-registro.js) | `TiposRegistro` | Definición y consulta de tipos de registro especiales (feriado, vacaciones, enfermedad, compensatorio, remoto, etc.). |
| [`src/services/gestor-historial.js`](../src/services/gestor-historial.js) | `GestorHistorial` | Pila de estados en memoria y `localStorage` para Deshacer (`undo`) y Rehacer (`redo`). |
| [`src/services/gestor-perfiles.js`](../src/services/gestor-perfiles.js) | `GestorPerfiles` | Gestión multi-perfil (creación, renombrado, eliminación, cambio de perfil activo y aislamiento de claves en storage). |
| [`src/services/feriados-ar.js`](../src/services/feriados-ar.js) | `FeriadosAR` | Detección de feriados nacionales del mes en curso y sugerencia automática de carga. |
| [`src/services/sincronizacion-gist.js`](../src/services/sincronizacion-gist.js) | `SincronizacionGist` | Cliente HTTP de la API de GitHub Gist (crear, subir, descargar respaldos en la nube y verificar hashes). |
| [`src/services/recordatorio-push.js`](../src/services/recordatorio-push.js) | `RecordatorioPush` | Suscripción Web Push (VAPID), programación y cancelación de recordatorios de fin de jornada con el Worker. |
| [`src/services/instalador-pwa.js`](../src/services/instalador-pwa.js) | `InstaladorPWA` | Captura de `beforeinstallprompt`, registro del Service Worker (`sw.js`) y aviso de actualizaciones. |
| [`src/services/uso-tracker.js`](../src/services/uso-tracker.js) | `UsoTracker` | Ping diario anónimo de estadísticas de uso hacia el Worker (`/api/hola`). |

### 4.4. Interfaz de usuario (`src/ui/`)

| Archivo | Export | Responsabilidad |
|---|---|---|
| [`src/ui/orquestador.js`](../src/ui/orquestador.js) | `OrquestadorUI` | Coordinador principal de UI: inicializa todos los submódulos visuales, listeners globales y conecta las notificaciones de `GestionDatos`. |
| [`src/ui/base.js`](../src/ui/base.js) | `UIBase` | Helpers DOM base (toasts, errores de campos, popups flotantes, swipes táctiles, descarga de archivos y helpers de botones). |
| [`src/ui/animaciones.js`](../src/ui/animaciones.js) | `Animaciones` | Transiciones suaves de altura, fade/swap de elementos, mutación animada de textos y scroll asistido. |
| [`src/ui/gestor-temas.js`](../src/ui/gestor-temas.js) | `GestorTemas` | Cambio de tema claro/oscuro y sincronización de `meta[name="theme-color"]`. |
| [`src/ui/gestor-modales.js`](../src/ui/gestor-modales.js) | `GestorModales` | Apertura/cierre de modales accesibles, historial de navegación entre modales y diálogos de confirmación (`confirmar`). |
| [`src/ui/tarjeta-fichaje.js`](../src/ui/tarjeta-fichaje.js) | `TarjetaFichaje` | Tarjeta principal de fichaje del día/semana (barra de progreso, hints de salida estimada, ciclo de textos y actualización general). |
| [`src/ui/tarjeta-tiempo-fuera.js`](../src/ui/tarjeta-tiempo-fuera.js) | `TarjetaTiempoFuera` | Cronómetro en vivo de tiempo fuera (pausa/almuerzo) en la tarjeta principal. |
| [`src/ui/tarjeta-lote.js`](../src/ui/tarjeta-lote.js) | `TarjetaLote` | Modo de carga por lote (múltiples días/licencias desde la tarjeta principal) y helpers de inputs de hora/fecha. |
| [`src/ui/tarjeta-fondos.js`](../src/ui/tarjeta-fondos.js) | `TarjetaFondos` | Selector, sanitización segura con `DOMParser` y renderizado de fondos SVG en la tarjeta de fichaje. |
| [`src/ui/calendario.js`](../src/ui/calendario.js) | `Calendario` | Vista de calendario mensual interactivo en el historial, selector de meses/años y popups de detalle diario. |
| [`src/ui/historico.js`](../src/ui/historico.js) | `Historico` | Renderizado de la lista histórica agrupada por año/mes/semana, grupos de licencias y acciones por fila. |
| [`src/ui/historico-edicion.js`](../src/ui/historico-edicion.js) | `HistoricoEdicion` | Modales de edición individual y de grupo, candado de bloqueo de edición y popup de filtros. |
| [`src/ui/estadisticas.js`](../src/ui/estadisticas.js) | `Estadisticas` | Tarjeta de estadísticas (semanal, mensual, anual), cálculo de métricas y popups explicativos de cada indicador. |
| [`src/ui/reportes.js`](../src/ui/reportes.js) | `Reportes` | Generación y descarga de reportes HTML autocontenidos con CSP propia y selector de secciones. |
| [`src/ui/configuracion.js`](../src/ui/configuracion.js) | `Configuracion` | Modal de configuración (jornada laboral, días hábiles, toggles de cálculo, selector de fondo y modal de ayuda). |
| [`src/ui/historial-dias.js`](../src/ui/historial-dias.js) | `HistorialDias` | Modal para administrar tramos históricos de días hábiles cuando cambia la jornada laboral del usuario. |
| [`src/ui/perfiles.js`](../src/ui/perfiles.js) | `Perfiles` | Selector de perfil activo y modal de creación/edición/eliminación de perfiles. |
| [`src/ui/gist-respaldo.js`](../src/ui/gist-respaldo.js) | `GistRespaldo` | Configuración de token/ID de GitHub Gist, sincronización manual/automática y resolución de conflictos. |
| [`src/ui/respaldo-local.js`](../src/ui/respaldo-local.js) | `RespaldoLocal` | Modales y flujo de exportación (completa, mensual o por rango) e importación de archivos `.json` locales. |
| [`src/ui/orden-tarjetas.js`](../src/ui/orden-tarjetas.js) | `OrdenTarjetas` | Visibilidad de tarjetas principales y reordenamiento drag-and-drop. |
| [`src/ui/notificaciones.js`](../src/ui/notificaciones.js) | `Notificaciones` | Modal y controles de configuración de avisos Web Push (anticipación, uso de saldo semanal). |
| [`src/ui/bienvenida-modal.js`](../src/ui/bienvenida-modal.js) | `BienvenidaModal` | Onboarding inicial para configurar horas diarias y días hábiles en el primer uso. |
| [`src/ui/aviso-push.js`](../src/ui/aviso-push.js) | `AvisoPush` | Banner sugerido para activar notificaciones de fin de jornada luego de alcanzar el umbral de uso. |

---

## 5. Guía de decisión: ¿Dónde ubicar una nueva función o módulo?

Cuando necesites agregar una funcionalidad nueva, usá estas preguntas para decidir su ubicación exacta:

### Caso A: Es una función pura (cálculo matemático, formato de fecha/hora, validación o criptografía)
- **¿No depende del dominio de horarios ni del DOM?** → Va en `src/core/`.
  - *Ejemplo:* Convertir minutos a formato decimal (`8.5h`) → [`src/core/tiempo-utils.js`](../src/core/tiempo-utils.js).
  - *Ejemplo:* Validar el formato de una URL o sanitizar un campo nuevo → [`src/core/seguridad.js`](../src/core/seguridad.js).

### Caso B: Es un catálogo estático de datos (sin lógica)
- **¿Es una lista fija de feriados, íconos, plantillas o configuraciones predeterminadas?** → Va en `src/data/`.
  - *Ejemplo:* Nuevos fondos decorativos o feriados de un nuevo año → [`src/data/fondos.js`](../src/data/fondos.js) o [`src/data/feriados.js`](../src/data/feriados.js).

### Caso C: Es una regla de negocio, cálculo sobre los registros o integración con una API/Storage
- **¿Calcula saldos, filtra registros, transforma datos para guardar o habla con una API externa (Gist, Google Drive, Worker)?** → Va en `src/services/`.
  - **Importante:** Si necesita leer el estado (`registros`, `diasHabiles`, `horasDiarias`), debe importar [`EstadoApp`](../src/services/estado-app.js) (`import { EstadoApp } from './estado-app.js'`), **no** `GestionDatos`, para no introducir ciclos.
  - *Ejemplo:* Regla para calcular francos compensatorios → [`src/services/compensatorios.js`](../src/services/compensatorios.js).
  - *Ejemplo:* Sincronización con Google Drive → Nuevo módulo `src/services/drive-sync.js`.

### Caso D: Lee inputs del usuario, modifica el DOM, abre un modal o dibuja en pantalla
- **¿Interactúa con elementos HTML, eventos de click/teclado o muestra alertas?** → Va en `src/ui/`.
  - Si extiende una vista existente y el archivo tiene **menos de 500 líneas**, agregalo en el módulo correspondiente (`calendario.js`, `configuracion.js`, etc.).
  - Si la funcionalidad supera **~250–300 líneas** o tiene un ciclo de vida propio, creá un archivo dedicado en `src/ui/` con prefijo semántico:
    - Subcomponentes de la tarjeta principal: `src/ui/card-<nombre>.js`
    - Vistas o paneles generales: `src/ui/ui-<nombre>.js`
  - **Regla anti-ciclos en `src/ui/`:** Un submódulo hijo (`tarjeta-tiempo-fuera.js`, `reportes.js`, `respaldo-local.js`) **no debe importar** a su módulo padre (`tarjeta-fichaje.js`, `estadisticas.js`, `gist-respaldo.js`). Si necesita notificar un cambio hacia arriba, usá `EventosApp.emit(...)` o inyectá un callback desde el padre.

### Checklist obligatorio al crear o renombrar un archivo `.js`

1. **Usar `import`/`export` con extensión `.js` explícita** (obligatorio en ES Modules nativos del navegador, ej. `import { TiempoUtils } from '../core/tiempo-utils.js';`).
2. **Registrar el archivo en [`sw.js`](../sw.js):**
   - Agregar la ruta en el array `urlsToCache`.
   - Actualizar la constante `CACHE_NAME` para invalidar la caché anterior.
3. **Correr la suite de validación arquitectónica y de dominio:**
   ```bash
   node --test tests/*.test.mjs
   ```

---

## 6. Historial de mejoras arquitectónicas aplicadas

| ID | Mejora arquitectónica | Estado |
|---|---|---|
| **ARQ-1** | Partición del monolito `app.js` (11.366 líneas) en módulos ES nativos bajo `src/` y reorganización de `assets/` en la raíz | ✅ Aplicado |
| **ARQ-2** | Eliminación de las 6 violaciones de capa ascendentes (`core` → `services` y `services` → `ui`) mediante `Almacenamiento.setProfileKeyResolver` y callbacks en `EstadoApp._notify()` | ✅ Aplicado |
| **ARQ-3** | Creación de [`src/services/estado-app.js`](../src/services/estado-app.js) y eliminación del 100% de las dependencias circulares en `src/services/` y `src/ui/` (0 ciclos en todo el grafo) | ✅ Aplicado |
| **ARQ-4** | Extracción de [`src/services/filtros-periodos.js`](../src/services/filtros-periodos.js) reduciendo `gestion-datos.js` de 1.004 a 572 líneas | ✅ Aplicado |
| **ARQ-5** | Creación del bus de eventos liviano [`src/core/eventos.js`](../src/core/eventos.js) (`EventosApp`) para comunicación desacoplada entre módulos | ✅ Aplicado |
| **ARQ-6** | Suite de tests automatizados con `node --test` en [`tests/architecture.test.mjs`](../tests/architecture.test.mjs) y [`tests/domain.test.mjs`](../tests/domain.test.mjs) (sin dependencias externas) | ✅ Aplicado |
