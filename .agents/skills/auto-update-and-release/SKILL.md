---
name: auto-update-and-release
description: >-
  Guía obligatoria y flujo de trabajo para la publicación de versiones,
  auto-actualizaciones en segundo plano con Squirrel/GitHub y configuración
  de inicio en Windows para el proyecto Mis Frases.
---

# Mis Frases: Estándar Obligatorio de Auto-Actualización y Publicación

Este documento define la arquitectura y las reglas estrictas que **cualquier agente o IA debe respetar** al realizar modificaciones, mejoras o publicaciones de nuevas versiones en el proyecto `mis-frases`.

---

## 1. Regla Fundamental: Integridad del Sistema de Auto-Actualización

El proyecto cuenta con un mecanismo de **Auto-Actualización Silenciosa en Segundo Plano** basado en `update-electron-app`, Electron Forge, Squirrel.Windows y GitHub Releases.

Bajo ninguna circunstancia se debe eliminar, deshabilitar o alterar esta lógica:
- `src/main/lifecycle/AutoUpdateService.ts` debe mantenerse siempre activo e inicializarse en `AppLifecycleService.ts`.
- La configuración de `publishers` con `PublisherGithub` y `MakerSquirrel` en `forge.config.ts` es obligatoria.
- El campo `"repository"` en `package.json` debe apuntar siempre al repositorio oficial (`https://github.com/marcomarca/misfrases.git`).

---

## 2. Flujo Obligatorio para Publicar una Nueva Versión

Cuando se implemente una mejora o cambio de versión:

### Paso 1: Actualizar versión y registro de cambios
1. Incrementar la versión en `package.json` (ej: `1.0.2`) siguiendo Semantic Versioning.
2. Documentar los cambios en `CHANGELOG.md` bajo el estándar *Keep a Changelog* (secciones `Added`, `Changed`, `Fixed`, etc.).

### Paso 2: Compilación y empaquetado de distribución
1. Ejecutar:
   ```bash
   bun run make
   ```
2. Este comando genera los siguientes artefactos obligatorios en `release/make/squirrel.windows/x64/` y `release/make/zip/win32/x64/`:
   - `MisFrases-X.X.X Setup.exe` (Instalador independiente)
   - `MisFrases-win32-x64-X.X.X.zip` (Versión portable)
   - **`RELEASES`** (Índice de versiones de Squirrel - **CRÍTICO**)
   - **`MisFrases-X.X.X-full.nupkg`** (Paquete de actualización de Squirrel - **CRÍTICO**)
   - **`MisFrases-X.X.X-delta.nupkg`** (Paquete diferencial si aplica - **CRÍTICO**)

### Paso 3: Publicación en GitHub Releases
1. Crear el commit y push a la rama `main`.
2. Crear la release en GitHub (`vX.X.X`) subiendo **TODOS** los archivos anteriores:
   ```bash
   gh release create vX.X.X \
     "release/make/squirrel.windows/x64/MisFrases-X.X.X Setup.exe" \
     "release/make/squirrel.windows/x64/MisFrases-X.X.X-full.nupkg" \
     "release/make/squirrel.windows/x64/RELEASES" \
     "release/make/zip/win32/x64/MisFrases-win32-x64-X.X.X.zip" \
     --title "vX.X.X - MisFrases para Windows" \
     --notes "..."
   ```

> ⚠️ **ADVERTENCIA CRÍTICA:** Si no se suben los archivos `RELEASES` y `.nupkg`, los clientes existentes con versiones anteriores **no podrán detectar ni descargar la actualización automática**.

---

## 3. Regla de Inicio en Segundo Plano en Windows (`LoginItemService`)

- Toda configuración de inicio automático en Windows (`openAtLogin`) debe gestionarse a través de `src/main/lifecycle/LoginItemService.ts`.
- **Modo empaquetado (`app.isPackaged`):** Debe registrarse con el argumento `args: ['--hidden']` para arrancar en la bandeja del sistema (System Tray) sin desplegar la ventana principal.
- **Modo desarrollo (`!app.isPackaged`):** Debe mantenerse deshabilitado (`openAtLogin: false`) para evitar escribir `electron.exe` en el registro de Windows (`HKCU\...\Run`), lo cual causaría la pantalla de bienvenida por defecto de Electron al reiniciar la PC.

---

## 4. Verificación de Calidad

Antes de dar por concluida cualquier modificación:
1. `bun run typecheck` (0 errores de TypeScript).
2. `bun test` (todos los tests unitarios pasando).
3. `bun run benchmark` (verificar que no se hayan introducido degradaciones de rendimiento ni fugas de memoria).
