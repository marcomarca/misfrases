# RUN.MD — Guía Ultracondensada de Comandos

Guía rápida de comandos de ejecución, pruebas, desarrollo y atajos de **Mis Frases**.

---

## 1. Comandos del Proyecto (Terminal)

```bash
# Instalar dependencias
bun install --ignore-scripts

# Reconstruir módulos nativos para Electron (primera vez o tras actualizar deps)
bunx electron-rebuild

# Iniciar en modo desarrollo (compila y abre la app)
bun run dev

# Ejecutar suite de pruebas unitarias e integración
bun test

# Verificación estricta de tipos TypeScript
bun run typecheck

# Compilar TypeScript y copiar assets a dist/
bun run build

# Ejecutar Spike P0 (validación aislada de Win32/Koffi/SendInput)
bun run spike

# Empaquetar aplicación para Windows x64
bun run package

# Generar instalador ejecutable (Setup.exe)
bun run make
```

---

## 2. Uso y Atajos en el Programa

| Acción | Combinación / Tecla | Comportamiento |
|---|---|---|
| **Disparar Frase Única** | `Hotkey` configurado (ej: `Ctrl+Alt+P`) | Inserta el texto inmediatamente en la ventana activa. |
| **Disparar Frases Compartidas** | `Hotkey` con 2–10 frases | Abre el popup selector flotante junto al cursor. |
| **Seleccionar Slot** | Teclas `1` a `9` | Inserta la frase asignada al slot 1..9 y cierra el popup. |
| **Seleccionar Slot 10** | Tecla `0` | Inserta la frase asignada al slot 10 y cierra el popup. |
| **Cancelar Popup** | Tecla `Escape` o clic fuera | Cierra el popup sin modificar el texto ni el portapapeles. |
| **Ocultar Ventana Principal** | Botón `X` | Minimiza la aplicación a la bandeja del sistema (System Tray). |
| **Cerrar Aplicación** | Tray -> `Salir` | Cierra completamente el proceso y libera los atajos globales. |

---

## 3. Reglas de Atajos (Hotkeys)

* **Combinaciones válidas:** Deben incluir al menos un modificador (`Ctrl`, `Alt`, `Shift`, `Win`) acompañado de una tecla, o una tecla de función (`F1`..`F24`) sola.
* **Teclas individuales:** Letras o números solos (ej: `A`, `5`) son rechazados para evitar bloquear la escritura normal.
* **Slots:** Máximo 10 frases activas por cada atajo de teclado.

---

## 4. Ubicación de Archivos de Datos

```text
%APPDATA%\MisFrases\
├── database\app.sqlite3   # Base de datos SQLite local
├── logs\app.log           # Registro de eventos y errores
└── backups\               # Directorio de respaldos
```
