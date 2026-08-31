# Mis Frases 🚀

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078D6.svg?logo=windows&logoColor=white)](https://microsoft.com/windows)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Electron](https://img.shields.io/badge/Electron-34-47848F.svg?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Bun](https://img.shields.io/badge/Bun-1.2-fbf0df.svg?logo=bun&logoColor=black)](https://bun.sh/)

**Mis Frases** es una aplicación de escritorio para Windows diseñada para optimizar la productividad mediante la gestión y expansión ultrarrápida de fragmentos de texto, plantillas y prompts de uso frecuente mediante atajos de teclado globales.

---

## ✨ Características Principales

- ⚡ **Expansión Instantánea:** Inserta frases o prompts en cualquier aplicación de Windows usando atajos globales (`Ctrl`, `Alt`, `Shift`, `Win` + Tecla o teclas de función `F1`-`F24`).
- 🎯 **Selector Contextual Flotante:** Si un atajo tiene asignadas múltiples frases (hasta 10 por grupo), se despliega un menú selector junto al cursor para elegir la frase deseada pulsando las teclas `1` al `9` o `0` (slot 10).
- 🖱️ **Reordenamiento Intuitivo (Drag & Drop):** Organiza tus frases y reasigna los números de slot arrastrando y soltando elementos en la interfaz principal.
- 📋 **Protección del Portapapeles (`ClipboardGuard`):** Copia e inserta el texto mediante la API nativa de Win32 (`SendInput` vía `koffi`) restaurando el contenido previo del portapapeles de forma transparente.
- 🗄️ **Almacenamiento Local Robusto:** Base de datos SQLite integrada (`better-sqlite3`) en modo WAL (*Write-Ahead Logging*) con migraciones automáticas.
- 🔔 **Notificaciones Toast Integradas:** Confirmación visual no invasiva de cambios, activaciones, guardado de orden y modificaciones.
- 🎛️ **Bandeja del Sistema (System Tray):** Minimización en segundo plano con icono interactivo y control de instancia única.
- 📊 **Métricas de Uso:** Registro estadístico transaccional de frases utilizadas.

---

## 🛠️ Tecnologías Utilizadas

- **Runtime & Empaquetador:** [Electron 34](https://www.electronjs.org/) + [Bun](https://bun.sh/)
- **Lenguaje:** [TypeScript 5.7](https://www.typescriptlang.org/)
- **Base de Datos:** [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) (SQLite WAL)
- **Integración Win32 Nativa:** [koffi](https://koffi.dev/) (FFI C/C++ de alto rendimiento para `user32.dll` / `SendInput`)
- **Validación de Datos:** [Zod](https://zod.dev/)
- **Build & Distribución:** [Electron Forge](https://www.electronforge.io/)

---

## 📋 Requisitos Previos

- **Sistema Operativo:** Windows 10 o Windows 11 (64-bit)
- **Runtime:** [Bun](https://bun.sh/) (v1.2+) o [Node.js](https://nodejs.org/) (v20+)
- **Herramientas de Compilación C++:** Requeridas para reconstruir módulos nativos (`better-sqlite3` y `koffi`) para la versión de Node embebida en Electron.

---

## 🚀 Instalación y Desarrollo

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/marcomarca/misfrases.git
   cd misfrases
   ```

2. **Instalar dependencias:**
   ```bash
   bun install --ignore-scripts
   ```

3. **Reconstruir módulos nativos para Electron:**
   ```bash
   bunx electron-rebuild
   ```

4. **Iniciar en modo desarrollo:**
   ```bash
   bun run dev
   ```

---

## 🧪 Pruebas y Verificación

```bash
# Ejecutar suite de pruebas unitarias (17 tests)
bun test

# Verificación estricta de tipos TypeScript
bun run typecheck

# Validar integración de Win32/Koffi de forma aislada
bun run spike
```

---

## 📦 Compilación y Empaquetado

```bash
# 1. Compilar TypeScript y empaquetar renderer a dist/
bun run build

# 2. Generar ejecutable portable en release/
bun run package

# 3. Generar instalador de Windows (Setup.exe)
bun run make
```

---

## ⌨️ Atajos y Navegación

| Acción | Combinación / Tecla | Comportamiento |
|---|---|---|
| **Disparar Frase Única** | Atajo configurado (ej: `Ctrl+Alt+P`) | Expande e inserta el texto inmediatamente en la ventana activa. |
| **Disparar Frases Múltiples** | Atajo con 2 a 10 frases | Abre el selector flotante junto al cursor. |
| **Seleccionar Slot 1 al 9** | Teclas `1` a `9` | Inserta la frase correspondiente y cierra el selector. |
| **Seleccionar Slot 10** | Tecla `0` | Inserta la frase del slot 10 y cierra el selector. |
| **Cancelar Selector** | Tecla `Escape` o clic fuera | Cierra el selector sin modificar el foco ni el portapapeles. |
| **Ocultar Ventana** | Botón `X` de la ventana | Oculta la app en la bandeja del sistema (System Tray). |
| **Cerrar Totalmente** | Menú Tray -> `Salir` | Cierra el proceso y libera todos los atajos registrados. |

---

## 📁 Ubicación de Datos de Usuario

Los datos persistentes de la aplicación se almacenan en:

```text
%APPDATA%\MisFrases\
├── database\app.sqlite3   # Base de datos SQLite local (WAL mode)
├── logs\app.log           # Registro de auditoría y operaciones
└── backups\               # Directorio reservado para respaldos
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

## 📜 Historial de Versiones

Para consultar el detalle de cambios, correcciones y novedades de cada versión, revisa el archivo [CHANGELOG.md](CHANGELOG.md).

---

## 🗺️ Roadmap y Futuras Mejoras

Para ver o proponer nuevas funcionalidades pendientes, consulta el archivo [BACKLOG.md](BACKLOG.md).


