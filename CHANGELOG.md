# Registro de Cambios (Changelog)

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
