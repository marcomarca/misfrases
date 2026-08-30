# Registro de Cambios (Changelog)

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.0.1] - 2026-08-30

### 🐛 Corregido (Fixed)
- **Arranque en segundo plano con Windows:** Se incluyó el flag `--hidden` en el registro de inicio del sistema (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`), garantizando que la aplicación inicie silenciosamente en la bandeja del sistema (System Tray) sin desplegar la ventana principal sobre el escritorio al iniciar sesión.
- **Prevención de pantalla por defecto de Electron al reiniciar:** Se implementó `LoginItemService` para evitar que ejecuciones en modo desarrollo registren el binario base `node_modules\electron\dist\electron.exe` sin argumentos en el arranque de Windows, corrigiendo la aparición no deseada del panel de bienvenida de Electron tras reiniciar el equipo.
- **Aislamiento seguro de auto-inicio:** La configuración de inicio automático ahora solo se inyecta en el registro del sistema operativo cuando la aplicación se ejecuta empaquetada (`app.isPackaged`).

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
