# Registro de Cambios (Changelog)

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [1.4.3] - 2026-09-13

### 🐛 Corregido (Fixed)
- **Visualización Dinámica de Versión en Configuración:** Se eliminó el texto estático `v1.1.1` del HTML principal y se implementó la obtención y actualización dinámica de la versión instalada (`app.getVersion()`) tanto al abrir la vista de Configuración como al consultar actualizaciones automáticas.
- **Canal IPC para Consulta de Versión:** Se añadió `AUTOUPDATE_GET_VERSION` en constantes IPC, handlers principales y puente `preload` para sincronizar con fidelidad la versión activa de la aplicación en la interfaz gráfica.

---

## [1.4.2] - 2026-09-13

### ♻️ Refactorización y Simplificación (Refactored & Simplified)
- **Eliminación de Complejidad Accidental y Wrappers:** Eliminación de wrappers redundantes sin valor añadido (`StatisticsService`, `SingleInstanceService`, `LoginItemService` y `AdministratorService`), integrando su lógica directamente y conectando `UsageRepository` de forma inmediata con `ExpansionService` e IPC handlers.
- **Limpieza de Código Muerto en Win32 FFI:** Eliminación de 65 líneas no utilizadas de inyección de pulsaciones unicode por teclado (`sendUnicode()`), consolidando el pipeline de inyección instantánea por portapapeles (`sendPaste()`).
- **Eliminación de Tipos, Esquemas y Métodos Fósiles:** Retiro de `canSnapshotSafely()`, `AVAILABLE_VARIABLES`, `HotkeyRepository.findById()`, `UsageEvent`, `sequenceNumber`, `HOTKEYS_LIST_GROUPS`, `ImportBackupOptionsSchema` y el script de prueba inicial `p0-spike.ts`.

---

## [1.4.1] - 2026-09-07

### 🐛 Corregido (Fixed)
- **Apertura Involuntaria del Menú Inicio:** Se eliminaron las teclas Windows (`VK_LWIN`, `VK_RWIN`) del conjunto de modificadores liberados sintéticamente en `forceReleaseModifiers()`, y se retiró dicha llamada del arranque (`bootstrap()`) y apagado (`shutdown()`) en `AppLifecycleService`. Además, ahora se consulta `GetAsyncKeyState` para despachar `KEYUP` únicamente sobre modificadores físicamente presionados.
- **Inyección Accidental de Frases con Atajos Externos:** En la ventana flotante del selector (`selector.ts`), se añadieron guardas para descartar pulsaciones de teclado acompañadas de modificadores (`Ctrl`, `Alt`, `Meta`), se bloqueó el comportamiento predeterminado de `Space` y `Enter` que activaba botones enfocados, y se implementó un detector de pérdida de foco (`blur`) que cancela la selección de inmediato.
- **Limpieza de Estado en Selector:** Limpieza estricta de `currentSnippets` y `targetHwnd` al cerrar el selector en `SelectorWindowService`.
- **Compatibilidad de Compilación en Scripts:** Actualización en `scripts/build.ts` para ejecutar `bun x tsc` en lugar de invocar directamente `tsc`, asegurando compatibilidad en cualquier entorno de terminal.

---

## [1.4.0] - 2026-09-06

### ✨ Añadido (Added)
- **Sistema de Memoria IA (Context Blocks):** Módulo para definir, editar y componer bloques de contexto y memoria reutilizables (perfil base, stack de software, stack de hardware, principios de arquitectura y directrices personalizadas) con base de datos SQLite v3.
- **Acceso Rápido en Selector Flotante (Teclas QWER):** Barra superior de memoria compacta en el selector de atajos para inyectar bloques con teclas dedicadas (`Q`, `W`, `E`, `R`, `T`, `Y`) sin cerrar el menú selector.
- **Inserción Dinámica en Editor de Prompts:** Chips interactivos para insertar macros `{{@clave}}` en la posición del cursor dentro de cualquier frase.
- **Copia de Seguridad y Restauración de Memoria:** Exportación e importación de bloques de memoria en formato JSON compatible con versiones anteriores.

### ⚡ Rendimiento y Estabilidad (Performance & Stability)
- **Pipeline Unificado de Portapapeles de Alta Velocidad:** Eliminación de la escritura tecla a tecla lenta; todas las frases y bloques de memoria se inyectan a través del portapapeles con `Ctrl+V` nativo y restauración instantánea de datos previos (texto, HTML e imágenes).
- **Separación Limpia de Bloques con Salto de Línea:** Adición automática de carácter `\n` al pegar bloques en cadena, evitando eventos de tecla `Enter` simulados que puedan disparar envíos accidentales en chats o interfaces web de IA.

---

## [1.3.1] - 2026-09-06

### 🐛 Corregido (Fixed)
- **Serialización Win32 en SendInput y Soporte x64:** Empaquetado binario contiguo de 40 bytes para la estructura nativa `tagINPUT` con alineación de 8 bytes en `dwExtraInfo`, corrigiendo el fallo sistemático en `sendPaste()`.
- **Prevención de Atascamiento de Teclas (Key Latching):** Se implementó `forceReleaseModifiers()` para purgar `VK_CONTROL`, `VK_MENU` (Alt), `VK_SHIFT`, `VK_LWIN`, `VK_RWIN` y `VK_V` en el arranque del sistema (`bootstrap()`), apagado (`shutdown()`) y alrededor de cada inyección de texto. Evita que atajos ajenos (como `Ctrl+N` en navegadores) ejecuten pegados involuntarios.
- **Normalización de Saltos de Línea en Portapapeles:** Normalización CRLF/LF en `ClipboardGuard.restore()`, evitando que la conversión interna de saltos de línea de Windows bloquee la restauración del portapapeles y deje frases residuales.
- **Resiliencia con Fallback a `keybd_event` y Unicode:** Si `SendInput` es bloqueado por UIPI o falla, se ejecuta fallback a `keybd_event` y a inyección Unicode directa.

---

## [1.3.0] - 2026-09-01

### ✨ Añadido (Added)
- **Tablas Agrupadas por Atajo de Teclado:** Reorganización completa de la biblioteca principal en bloques y tarjetas separadas para cada atajo registrado.
- **Cabeceras de Atajo con Acciones Rápidas:** Keycaps visuales integrados, indicador de slots ocupados (`N/10 slots`), botón de reordenamiento directo y creación preconfigurada de frases por atajo.
- **Mayor Espacio y Legibilidad:** Eliminación de columnas redundantes dentro de las filas para maximizar el área de lectura de títulos, descripciones y contenido a expandir.

---

## [1.2.1] - 2026-08-31

### ✨ Añadido y Mejorado (Added & Improved)
- **Barra Superior Integrada de Alto Rendimiento:** Reemplazo de la barra estándar de Windows por una barra de título personalizada estilizada, con aceleración por hardware (`-webkit-app-region: drag`) y controles nativos de ventana.
- **Previsualización Dinámica de Variables en Vivo:** Tooltips flotantes interactivos sobre cada variable dinámica (`{{date}}`, `{{time}}`, etc.) mostrando el valor exacto generado en tiempo real.
- **Botones de Reordenamiento Vectoriales:** Sustitución de caracteres de texto por botones squircle redondeados con iconos SVG Chevron.
- **Scroll Horizontal en Tablas:** Contenedor de tablas responsivo con desplazamiento horizontal suave y barra de scroll estilizada en pantallas compactas.

### 🐛 Corregido (Fixed)
- **Modo Claro en Globos Emergentes:** Ajuste de paleta de colores en tooltips `(?)` para garantizar fondo blanco y alto contraste en tema claro.

---

## [1.2.0] - 2026-08-31

### ✨ Añadido (Added)
- **Rediseño UI/UX Moderno y Minimalista:** Interfaz completamente modernizada con tarjetas de configuración agrupadas por sección, divisores limpios y sombras suaves.
- **Sistema de Tooltips Contextuales `(?)`:** Iconos de ayuda flotantes interactivos en cada opción de configuración con animaciones y descripciones detalladas.
- **Barra Lateral con Squircles de Color:** Iconos vectoriales temáticos nítidos y píldora de navegación activa de alto contraste.
- **Keycaps Táctiles:** Renderizado visual de atajos de teclado como teclas individuales físicas (`<kbd>Ctrl</kbd>`, `<kbd>Alt</kbd>`, `<kbd>P</kbd>`).

---

## [1.1.1] - 2026-08-31

### 🐛 Corregido (Fixed)
- **Comprobación de Actualizaciones en Modo Portable y Desempaquetado:** Se implementó `isSquirrelInstalled()` y fallback directo a la API de GitHub Releases vía HTTPS, resolviendo el error `Can not find Squirrel` al ejecutar la aplicación desde carpetas portables o compilaciones independientes sin instalador.

---

## [1.1.0] - 2026-08-31

### ✨ Añadido (Added)
- **Variables Dinámicas en Frases ([FEAT-02]):** Soporte para etiquetas dinámicas `{{date}}`, `{{time}}`, `{{datetime}}`, `{{year}}`, `{{month}}`, `{{day}}`, `{{hour}}`, `{{minute}}`, `{{second}}` y `{{clipboard}}` mediante el nuevo motor `TemplateEngine`.
- **Chips Rápidos de Variables:** Inserción de variables dinámicas con un solo clic desde el modal de creación y edición de frases.
- **Copia de Seguridad y Restauración JSON ([FEAT-03]):** Exportación de frases a archivos `.json` e importación transaccional con validación de esquemas Zod a través de `BackupService`.
- **Selector de Tema Oscuro / Claro / Sistema ([FEAT-04]):** Nueva opción en Configuración con cambio dinámico de tema y tokens CSS optimizados.
- **Comprobación Manual de Actualizaciones ([FEAT-01]):** Botón interactivo en Configuración para verificar disponibilidad de nuevas versiones en GitHub Releases en cualquier momento.

---

## [1.0.3] - 2026-08-31

### 🐛 Corregido (Fixed)
- **Aislamiento y Sincronización del Portapapeles:** Se implementó una pausa de sincronización deliberada (30 ms) previa a la emisión de `Ctrl+V` y se activó la restauración del snapshot original (`ClipboardGuard.restore()`), eliminando condiciones de carrera que provocaban que se pegara contenido anterior o corrupto al disparar un atajo.
- **Prevención de Conflictos con Imágenes e Historial de Windows:** Detección de formatos no seguros (imágenes, datos binarios) mediante `canSnapshotSafely()`. Ante la presencia de imágenes, el sistema conmuta automáticamente a inyección directa por `SendInput Unicode`, dejando el portapapeles y el Historial de Windows (`Win+V`) 100% intactos y libres de entradas corruptas.

---

## [1.0.2] - 2026-08-31

### ✨ Añadido (Added)
- **Sistema Integral de Auto-Actualización Silenciosa:** Integración de `update-electron-app` y `AutoUpdateService` para descargas automáticas de versiones en segundo plano desde GitHub Releases.
- **Gestión de Releases con Squirrel:** Publicación automática de índices `RELEASES` y paquetes `.nupkg` para actualizaciones delta eficientes.
- **Estandarización y Skills:** Inclusión de reglas de repositorio y skill `auto-update-and-release` para preservar la coherencia del ciclo de vida y distribución del software.

---

## [1.0.1] - 2026-08-30

### 🐛 Corregido (Fixed)
- **Arranque en segundo plano con Windows:** Se incluyó el flag `--hidden` en el registro de inicio del sistema (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`), garantizando que la aplicación inicie silenciosamente en la bandeja del sistema (System Tray) sin desplegar la ventana principal sobre el escritorio al iniciar sesión.
- **Prevención de pantalla por defecto de Electron al reiniciar:** Se implementó `LoginItemService` para evitar que ejecuciones en modo desarrollo registren el binario base `node_modules\electron\dist\electron.exe` sin argumentos en el arranque de Windows, corrigiendo la aparición no deseada del panel de bienvenida de Electron tras reiniciar el equipo.
- **Aislamiento seguro de auto-inicio:** La configuración de inicio automático ahora solo se inyecta en el registro del sistema operativo cuando la aplicación se ejecuta empaquetada (`app.isPackaged`).

### ✨ Añadido (Added)
- **Servicio de Actualización Automática Silenciosa (`AutoUpdateService`):** Integración con GitHub Releases y `update-electron-app` para comprobar y descargar actualizaciones en segundo plano cada 2 horas sin interrumpir el flujo de trabajo del usuario.
- **Suite de Pruebas de Rendimiento:** Pruebas automatizadas con Playwright y benchmarking de SQLite y pipeline de expansión de texto (`bun run benchmark`).

---

## [1.0.0] - 2026-08-28

### ✨ Añadido (Added)
- **Lanzamiento Inicial:** Aplicación de escritorio nativa para Windows desarrollada con Electron 34, TypeScript y Bun.
- **Expansión Global de Texto:** Inyección de frases y plantillas en cualquier aplicación activa mediante atajos de teclado (`Ctrl`, `Alt`, `Shift`, `Win` + Tecla o `F1`-`F24`).
- **Selector Contextual Flotante:** Menú emergente junto al cursor para atajos con múltiples frases asignadas (hasta 10 frases por atajo), seleccionables numéricamente (`1`-`9`, `0`).
- **Reordenamiento Drag & Drop:** Organización visual de frases y asignación dinámica de slots numéricos.
- **Protección del Portapapeles (`ClipboardGuard`):** Copia, pega y restauración transparente del portapapeles utilizando llamadas nativas Win32 (`SendInput` vía `koffi`).
- **Persistencia Local SQLite:** Base de datos SQLite integrada con modo WAL y control de migraciones automáticas.
- **Bandeja del Sistema (Tray):** Minimización en segundo plano con menú contextual para pausar/reanudar atajos, abrir interfaz y salir.
- **Modo Administrador Opcional:** Soporte de elevación de privilegios para permitir la inyección de texto en ventanas con integridad elevada (UIPI).
- **Métricas y Estadísticas:** Registro transaccional de frecuencia de uso por frase y atajo.
