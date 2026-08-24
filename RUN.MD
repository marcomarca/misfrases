# RUN.MD — Guía de Comandos y Referencia Operativa

Guía de comandos de desarrollo, empaquetado, atajos de teclado y estructura para **Mis Frases**.

---

## 1. Comandos del Proyecto (Terminal)

```bash
# 1. Instalar dependencias
bun install --ignore-scripts

# 2. Reconstruir módulos nativos C++ (better-sqlite3, koffi) para Electron
bunx electron-rebuild

# 3. Iniciar en modo desarrollo (compila assets y abre la app)
bun run dev

# 4. Ejecutar pruebas unitarias e integración (16 tests)
bun test

# 5. Verificación estricta de tipos TypeScript
bun run typecheck

# 6. Compilar TypeScript y empaquetar renderer/assets a dist/
bun run build

# 7. Ejecutar Spike P0 (validación aislada de Win32/Koffi/SendInput)
bun run spike

# 8. Empaquetar ejecutable autónomo (.exe portable en release-app/)
bun run package

# 9. Generar instalador de Windows (Setup.exe)
bun run make
```

---

## 2. Diferencia entre Carpetas de Salida

* **`dist/`**: Código JavaScript compilado y assets estáticos. Utilizado directamente por `bun run dev`.
* **`release-app/`**: Ejecutable final distribuible (`release-app\MisFrases-win32-x64\mis-frases.exe`) con runtime de Chromium y DLLs nativas empaquetadas.

---

## 3. Uso y Atajos en el Programa

| Acción | Combinación / Tecla | Comportamiento |
|---|---|---|
| **Disparar Frase Única** | `Hotkey` configurado (ej: `Ctrl+Alt+P`) | Expande e inserta el texto inmediatamente en la ventana activa. |
| **Disparar Frases Compartidas** | `Hotkey` con 2 a 10 frases | Abre el selector flotante junto al cursor. |
| **Seleccionar Slot 1 al 9** | Teclas `1` a `9` | Inserta la frase del slot correspondiente y cierra el selector. |
| **Seleccionar Slot 10** | Tecla `0` | Inserta la frase asignada al slot 10 y cierra el selector. |
| **Cancelar Selector** | Tecla `Escape` o clic fuera | Cierra el selector sin alterar el portapapeles ni el foco. |
| **Abrir DevTools (Modo Dev)** | Tecla `F12` | Abre la consola de herramientas de desarrollo de Electron. |
| **Ocultar Ventana** | Botón `X` de la ventana | Oculta la app en la bandeja del sistema (System Tray). |
| **Cerrar Totalmente** | Menú Tray -> `Salir` | Finaliza el proceso y libera todos los atajos globales. |

---

## 4. Reglas de Atajos (Hotkeys)

* **Combinaciones obligatorias:** Deben incluir al menos un modificador (`Ctrl`, `Alt`, `Shift`, `Win`) junto a una tecla, o una tecla de función (`F1`–`F24`) en solitario.
* **Teclas individuales:** Letras o números solos (ej: `A`, `5`) son bloqueados para no interferir con la escritura estándar.
* **Límite de Slots:** Máximo 10 frases activas por cada atajo de teclado.

---

## 5. Notificaciones Toast Integradas

La aplicación muestra feedback visual inmediato en la esquina inferior derecha ante:
* Activación / Desactivación de una frase.
* Creación y edición de frases.
* Duplicación y eliminación.
* Desplazamiento y guardado del orden de slots.
* Modificaciones en el panel de Configuración.

---

## 6. Ubicación de Archivos de Datos y Logs

```text
%APPDATA%\MisFrases\
├── database\app.sqlite3   # Base de datos SQLite local (WAL mode)
├── logs\app.log           # Registro de auditoría y operaciones
└── backups\               # Directorio reservado para respaldos
```
