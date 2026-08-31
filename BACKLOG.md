# Product Backlog & Roadmap de Futuras Mejoras

Este archivo contiene el registro estructurado de ideas, funcionalidades y mejoras pendientes para el proyecto **Mis Frases**.
Cualquier agente de IA o desarrollador debe consultar y actualizar este documento al planificar o implementar nuevas características.

---

## 📌 Estado de Tareas
- 💡 **Idea / Propuesta:** Registrada para futuro diseño e implementación.
- 📋 **Planificado:** Especificación lista para ser desarrollada.
- 🔨 **En Progreso:** Actualmente en desarrollo.
- ✅ **Completado:** Implementado, probado y liberado.

---

## 🚀 Backlog de Características

### 1. Sistema de Actualizaciones y Mantenimiento

#### 💡 [FEAT-01] Botón manual de "Buscar Actualizaciones" en Configuración
- **Descripción:** Añadir en la pestaña *Configuración* de la interfaz principal una sección de *Actualizaciones* con un botón interactivo *"Comprobar actualizaciones ahora"* y el estado actual de la versión instalada (ej: `Versión 1.0.2 - Actualizado`).
- **Comportamiento esperado:**
  1. Al pulsar el botón, el estado cambia a *"Buscando actualizaciones..."* con un spinner.
  2. Si está al día: Muestra un Toast *"Ya tienes la versión más reciente"*.
  3. Si hay una nueva versión: Muestra *"Descargando versión 1.X.X..."* y al finalizar despliega el modal para reiniciar.
- **Componentes a modificar:**
  - `src/renderer/main/index.html` y `src/renderer/main/app.ts` (UI y eventos).
  - `src/main/lifecycle/AutoUpdateService.ts` (método `checkForUpdatesManual()`).
  - `src/main/ipc/handlers.ts` y `src/shared/constants/index.ts` (canal IPC `autoupdate:check`).
- **Prioridad:** Media / Alta
- **Estado:** 💡 Idea

---

### 2. Expansión y Productividad

#### 💡 [FEAT-02] Variables dinámicas básicas en snippets
- **Descripción:** Permitir etiquetas como `{{date}}` (fecha actual), `{{time}}` (hora actual) o `{{clipboard}}` (contenido actual del portapapeles) dentro del texto de la frase para ser reemplazadas en el momento de la inyección.
- **Prioridad:** Media
- **Estado:** 💡 Idea

#### 💡 [FEAT-03] Exportación e Importación de Frases (Backup JSON)
- **Descripción:** Botones en Configuración para exportar todas las frases, grupos y atajos a un archivo `.json` y poder restaurarlos en otra máquina.
- **Prioridad:** Media
- **Estado:** 💡 Idea

---

### 3. Experiencia de Usuario (UI/UX)

#### 💡 [FEAT-04] Selector de tema (Oscuro / Claro)
- **Descripción:** Posibilidad de alternar entre tema oscuro actual y un tema claro de alto contraste.
- **Prioridad:** Baja
- **Estado:** 💡 Idea

---

## 📝 Instrucciones para Agentes de IA

Cuando el usuario solicite implementar una tarea del backlog:
1. Revisa la especificación en este archivo.
2. Sigue el flujo definido en [.agents/skills/auto-update-and-release/SKILL.md](.agents/skills/auto-update-and-release/SKILL.md).
3. Cambia el estado de la tarea a ✅ **Completado** e incluye la novedad en [CHANGELOG.md](CHANGELOG.md).
