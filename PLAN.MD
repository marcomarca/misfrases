No faltan preguntas de producto para la beta. A partir de aquí, cualquier decisión pendiente es suficientemente reversible como para que la tome la implementación.

Hay una corrección técnica respecto al portapapeles: **no debemos depender exclusivamente de `clipboard.writeText()` + restauración**, porque el portapapeles de Windows puede contener HTML, imágenes, RTF, archivos y formatos privados. Electron expone varios formatos, pero una restauración universal byte-a-byte no es trivial. ([Electron][1]) Por tanto, el requisito se redefine sin perder intención:

> **La aplicación nunca debe destruir el contenido previo del portapapeles.** Si puede preservarlo de forma segura, usa `paste`; si no, usa inyección Unicode sin modificarlo.

Con eso, esta es la especificación base.

# 1. Objetivo

Aplicación Windows tipo PhraseExpress, optimizada para snippets/prompts largos:

```text
hotkey global
→ resolver snippet(s)
→ 1 resultado: insertar
→ 2–10 resultados: popup junto al cursor
→ seleccionar con 1..9/0
→ insertar instantáneamente
→ registrar uso
```

Prioridad/número siempre manual.

---

# 2. Alcance

### IN — Beta V1

* Windows 10/11 x64.
* Node.js + Electron.
* SQLite 3 local.
* Datos en `%APPDATA%/<AppName>/`.
* Snippets de texto plano.
* Hotkeys globales.
* Hasta 10 snippets por hotkey.
* Hotkeys compartidos.
* Selector flotante.
* Selección `1..9, 0`.
* Prioridad manual.
* Conteo histórico.
* Eventos de uso para estadísticas.
* System Tray.
* Inicio con Windows configurable.
* Modo administrador.
* Multi-monitor.
* DPI diferente entre monitores.
* Restauración/preservación del clipboard.
* Pausa global de hotkeys.
* Instalador Windows beta.

### OUT — V1

* macOS/Linux.
* Cloud.
* Login/usuarios.
* Sincronización.
* Variables `{{date}}`.
* Formularios dinámicos.
* Rich text.
* IA.
* Compartir snippets.
* > 10 opciones por hotkey.
* Autoordenamiento.
* Firma digital.
* Auto-update.
* Telemetría externa.

---

# 3. Regla crítica de prioridad

[R] El uso **jamás modifica el orden**.

```text
slot 1 → Prompt A → 20 usos
slot 2 → Prompt B → 53 usos
slot 3 → Prompt C → 9.284 usos
```

Resultado:

```text
1 sigue siendo Prompt A
2 sigue siendo Prompt B
3 sigue siendo Prompt C
```

`usageCount` es exclusivamente información.

La única forma de cambiar los números es que el usuario lo haga explícitamente.

---

# 4. Concepto importante: `slot`, no ranking

Internamente no lo llamaría `priority`.

Usaría:

```ts
slot: 1 | 2 | 3 | ... | 10
```

Mapeo:

```text
slot 1  → tecla 1
slot 2  → tecla 2
...
slot 9  → tecla 9
slot 10 → tecla 0
```

Esto elimina una ambigüedad importante: no es un ranking estadístico, sino una posición estable controlada manualmente.

Si desactivas el elemento `2`:

```text
1 Prompt A
3 Prompt C
4 Prompt D
```

**3 no pasa automáticamente a ser 2.**

Si eliminas `2`, tampoco se renumeran los demás.

Nuevo snippet → primer slot libre.

---

# 5. Modelo de datos

## `hotkey_groups`

```text
id              TEXT PK
accelerator     TEXT UNIQUE NOT NULL
created_at      INTEGER NOT NULL
updated_at      INTEGER NOT NULL
```

Ejemplo:

```text
id: hk_01
accelerator: Control+Alt+P
```

---

## `snippets`

```text
id                TEXT PK
hotkey_group_id   TEXT NOT NULL FK
title             TEXT NOT NULL
content           TEXT NOT NULL
slot              INTEGER NOT NULL CHECK 1..10
enabled           INTEGER NOT NULL DEFAULT 1
usage_count       INTEGER NOT NULL DEFAULT 0
last_used_at      INTEGER NULL
created_at        INTEGER NOT NULL
updated_at        INTEGER NOT NULL
deleted_at        INTEGER NULL
```

Restricción:

```text
UNIQUE(hotkey_group_id, slot)
WHERE deleted_at IS NULL
```

Por construcción:

```text
1 hotkey = máximo 10 snippets no eliminados
```

---

## `usage_events`

```text
id          INTEGER PK AUTOINCREMENT
snippet_id  TEXT NOT NULL FK
used_at     INTEGER NOT NULL
```

Solo se inserta cuando la expansión se despachó correctamente.

Esto permite:

```text
usage_count
último uso
usos hoy
7 días
30 días
365 días
promedio diario
ranking por periodo
snippets sin uso reciente
```

Sin registrar:

```text
texto escrito
programa destino
ventana
documento
clipboard
```

---

## `settings`

```text
key          TEXT PK
value_json   TEXT NOT NULL
updated_at   INTEGER NOT NULL
```

Inicialmente:

```json
{
  "launchAtLogin": true,
  "administratorMode": true,
  "hotkeysEnabled": true,
  "startHidden": true
}
```

---

## `schema_migrations`

```text
version      INTEGER PK
applied_at   INTEGER NOT NULL
```

Toda modificación futura de SQLite necesita migración.

Nunca modificar el esquema manualmente durante startup.

---

# 6. Ubicación de datos

Usar:

```text
app.getPath("userData")
```

No escribir rutas `%APPDATA%` manualmente.

Electron proporciona ese directorio específicamente para datos de la aplicación. ([Electron][2])

Estructura:

```text
%APPDATA%\<AppName>\
│
├── database\
│   └── app.sqlite3
│
├── logs\
│   └── app.log
│
└── backups\
```

`backups/` queda preparado, pero backup automático es LATER.

---

# 7. Arquitectura

```text
┌──────────────────────────────────────────────┐
│                 Electron                    │
│                                              │
│  MAIN PROCESS                                │
│                                              │
│  AppLifecycleService                        │
│       │                                      │
│       ├── TrayService                       │
│       ├── SettingsService                   │
│       ├── DatabaseService                   │
│       ├── SnippetService                    │
│       ├── StatisticsService                 │
│       ├── HotkeyService                     │
│       ├── ExpansionService                  │
│       ├── PopupService                      │
│       └── WindowsService                    │
│               │                              │
│               ├── WindowFocus               │
│               ├── SendInput                 │
│               ├── ClipboardGuard            │
│               └── Administrator             │
│                                              │
├──────────────────────────────────────────────┤
│ PRELOAD                                      │
│                                              │
│ API mínima con contextBridge                 │
│                                              │
├──────────────────────────────────────────────┤
│ RENDERER                                     │
│                                              │
│ Main Window                                  │
│  ├── Snippets                               │
│  ├── Editor                                 │
│  ├── Hotkey recorder                        │
│  ├── Statistics                             │
│  └── Settings                               │
│                                              │
│ Selector Window                              │
│  └── menú 1..9 / 0                          │
└──────────────────────────────────────────────┘
```

Toda operación privilegiada pertenece a `main`.

Renderer:

```text
NO SQLite
NO Win32
NO filesystem
NO globalShortcut
NO clipboard nativo
```

Electron recomienda `contextIsolation`, renderer sandboxed, Node deshabilitado y APIs específicas mediante preload/IPC. ([Electron][3])

---

# 8. Stack fijado

| Tecnología          | Función             | Motivo                                   |
| ------------------- | ------------------- | ---------------------------------------- |
| Electron            | Desktop/runtime     | requisito                                |
| Node.js             | backend local       | requisito                                |
| TypeScript          | aplicación completa | reduce errores de contratos/IPC          |
| Electron Forge      | build/package       | empaquetado + rebuild de módulos nativos |
| HTML/CSS/TypeScript | UI V1               | no necesitamos framework todavía         |
| SQLite 3            | persistencia        | requisito                                |
| `better-sqlite3`    | driver              | API simple y transaccional               |
| Koffi 3.x           | Win32 FFI           | acceder a `user32.dll` desde Node        |
| Zod                 | validar IPC         | evita payloads inconsistentes            |

Electron necesita reconstruir módulos Node nativos para su ABI; Forge integra ese proceso. ([Electron][4])

Koffi puede llamar directamente DLLs Win32 desde Node y su documentación incluye incluso un ejemplo de `SendInput`. ([Koffi][5])

No usar:

```text
nut.js
robotjs
microservicios
servidor HTTP local
Redis
ORM
Redux
Docker
```

No resuelven ningún problema necesario de esta beta.

---

# 9. Estado global de la aplicación

```text
STARTING
   ↓
READY
   ├── PAUSED
   ├── SELECTOR_OPEN
   ├── EXPANDING
   └── SHUTTING_DOWN
```

Solo puede haber una expansión simultánea.

```text
EXPANDING
→ nuevos hotkeys ignorados
```

Con selector abierto:

```text
SELECTOR_OPEN
→ nuevo hotkey ignorado
→ Esc cancela
```

Esto evita carreras.

---

# 10. Hotkey global

Electron dispone de `globalShortcut` aunque la aplicación no tenga foco; el registro devuelve `false` si esa combinación no puede reservarse. ([Electron][6])

## Registro

No hacer:

```text
Ctrl+Alt+P → snippet A
Ctrl+Alt+P → snippet B
Ctrl+Alt+P → snippet C
```

Hacer:

```text
Ctrl+Alt+P
       ↓
HotkeyGroup
       ↓
[A, B, C]
```

Un registro OS por combinación única.

---

# 11. Capturador de hotkey

UI:

```text
Hotkey
┌──────────────────────────┐
│ Presiona una combinación │
└──────────────────────────┘
```

Usuario pulsa:

```text
Ctrl + Alt + P
```

Resultado:

```text
Control+Alt+P
```

Reglas:

* bare `A` → rechazado.
* bare `5` → rechazado.
* bare puntuación → rechazado.
* combinación con modificador → permitido.
* F1–F24 solos → permitido.
* combinación reservada/no registrable → error.
* hotkey ya usado dentro de nuestra aplicación → permitido.
* hotkey ocupado por otra aplicación → rechazado.

Durante captura:

```text
globalShortcut.setSuspended(true)
```

y después reanudar, para evitar ejecutar el propio hotkey mientras se está configurando. Electron soporta la suspensión global de shortcuts. ([Electron][6])

---

# 12. Crear snippet

Campos obligatorios:

```text
Título
Texto
Hotkey
Slot
Enabled
```

Flujo:

```text
Nuevo
→ título
→ contenido
→ capturar hotkey
→ detectar grupo existente
→ determinar primer slot libre
→ guardar
→ registrar/reconstruir hotkeys
→ listo
```

Validación:

```text
title: 1..120 caracteres
content: >= 1 carácter
slot: 1..10
hotkey válido
```

Sin límite pequeño artificial para el contenido.

---

# 13. Cuando hay un único snippet

Ejemplo:

```text
Ctrl+Alt+P
    ↓
1 snippet enabled
    ↓
ExpansionService
```

No abrir selector.

---

# 14. Cuando existen varios

Ejemplo:

```text
Ctrl+Alt+P

1 Traducir                    942 usos
2 Corregir                     83 usos
3 Resumir                   1.248 usos
0 Prompt largo                  7 usos
```

Los números son `slot`.

No ranking dinámico.

---

# 15. Popup

Configuración:

```text
frame: false
resizable: false
minimizable: false
maximizable: false
skipTaskbar: true
alwaysOnTop: true
focusable: true
```

Electron permite ventanas siempre encima y excluidas de taskbar. ([Electron][7])

Interacciones:

```text
1..9,0 → ejecutar
Esc → cerrar
clic opción → ejecutar
clic/foco fuera → cancelar
```

No timeout automático.

---

# 16. Posicionamiento del popup

Electron devuelve la posición absoluta del cursor y el display más cercano; las coordenadas usan DIP, por lo que podemos manejar correctamente escalado DPI. ([Electron][8])

Algoritmo:

```text
cursor = getCursorScreenPoint()
display = getDisplayNearestPoint(cursor)
area = display.workArea
```

Intentar:

```text
x = cursor.x + 12
y = cursor.y + 12
```

Si no cabe debajo:

```text
y = cursor.y - popup.height - 12
```

Finalmente:

```text
x = clamp(x, area.left, area.right - width)
y = clamp(y, area.top, area.bottom - height)
```

Criterio:

```text
popup.bounds ⊆ display.workArea
```

Siempre.

---

# 17. Problema del foco

Al pulsar:

```text
Ctrl+Alt+P
```

antes de mostrar popup:

```text
targetHWND = GetForegroundWindow()
```

Popup toma foco.

Usuario pulsa `2`.

Entonces:

```text
ocultar popup
→ validar IsWindow(targetHWND)
→ SetForegroundWindow(targetHWND)
→ esperar confirmación de foco
→ insertar
```

Sin guardar el `HWND` original, terminaríamos pegando dentro de nuestro propio popup.

---

# 18. WindowsInputService

Implementación mediante Koffi → `user32.dll`.

Funciones mínimas:

```text
GetForegroundWindow
IsWindow
SetForegroundWindow
GetAsyncKeyState
SendInput
```

El módulo queda completamente encapsulado:

```ts
interface WindowsInputService {
  getForegroundWindow(): WindowHandle;
  restoreForegroundWindow(hwnd: WindowHandle): Promise<boolean>;
  waitForModifiersReleased(): Promise<void>;
  sendPaste(): boolean;
  sendUnicode(text: string): boolean;
}
```

Ninguna otra capa conoce Koffi.

---

# 19. Inserción de texto

Estrategia:

```text
TextInsertionService
        │
        ├── Strategy A: ClipboardPaste
        │
        └── Strategy B: UnicodeInput
```

## Preferida

```text
clipboard seguro
→ snapshot
→ poner snippet
→ Ctrl+V
→ restore
```

## Fallback

```text
no podemos preservar clipboard con seguridad
→ no tocar clipboard
→ SendInput Unicode
```

Microsoft documenta que `SendInput` sintetiza eventos de teclado y que `INPUT_KEYBOARD` soporta entrada Unicode. ([Microsoft Learn][9])

---

# 20. ClipboardGuard

Contrato:

```ts
interface ClipboardGuard {
  canSnapshotSafely(): boolean;
  snapshot(): ClipboardSnapshot;
  setTemporaryText(text: string): void;
  restore(snapshot: ClipboardSnapshot): void;
}
```

Regla absoluta:

```text
si no sabemos restaurarlo
→ NO modificar clipboard
```

Además debemos evitar esto:

```text
T0 usuario tenía "ABC" copiado
T1 app pone snippet
T2 usuario copia "XYZ"
T3 app restaura "ABC" ← MAL
```

Por tanto se registra la secuencia/cambio del clipboard.

Si detectamos modificación externa después de nuestro paste:

```text
NO restaurar snapshot viejo
```

porque destruiríamos contenido nuevo.

---

# 21. Inserción ClipboardPaste

Flujo exacto:

```text
1. comprobar target HWND
2. esperar Ctrl/Alt/Shift/Win liberados
3. snapshot clipboard
4. poner snippet
5. SendInput(Ctrl+V)
6. comprobar que SendInput despachó eventos
7. margen breve para que destino consuma clipboard
8. comprobar que clipboard sigue siendo nuestro temporal
9. restaurar snapshot
10. registrar uso
```

Si falla antes de `5`:

```text
restaurar inmediatamente
→ error
→ NO statistic
```

Si falla después:

```text
best-effort restore
→ log
→ NO statistic si no se despachó paste
```

---

# 22. Por qué esperar que se liberen las teclas

El hotkey probablemente incluye:

```text
Ctrl+Alt+P
```

Si generamos inmediatamente:

```text
Ctrl+V
```

mientras `Alt` todavía figura presionado, Windows podría interpretar otra combinación.

Microsoft advierte que el estado actual de teclas puede interferir con `SendInput`. ([Microsoft Learn][9])

Por ello:

```text
GetAsyncKeyState(Ctrl)
GetAsyncKeyState(Alt)
GetAsyncKeyState(Shift)
GetAsyncKeyState(Win)
```

Polling corto hasta liberación.

---

# 23. Modo administrador

Windows aplica UIPI: un proceso solo puede inyectar entrada hacia procesos de nivel de integridad igual o inferior. ([Microsoft Learn][9])

Beta:

```text
Settings
[✓] Ejecutar en modo administrador
```

Si está activo:

```text
startup
→ comprobar elevation
→ si no elevated
→ relanzar mediante "runas"
→ UAC
→ cerrar instancia normal
```

Esto mantiene todo dentro del modelo Electron/Node.

### Limitación deliberada beta

Elevamos todo el proceso Electron.

```text
valor: simple
coste: Electron completo tiene privilegios elevados
```

Para una versión pública:

```text
Electron normal
+
helper nativo mínimo elevado
```

sería preferible.

Pero para una beta exclusivamente personal, el helper separado añade complejidad sin aportar suficiente valor.

---

# 24. Autostart

Setting:

```text
Iniciar con Windows: ON/OFF
```

Implementación:

```ts
app.setLoginItemSettings({
  openAtLogin: enabled
});
```

Electron lo soporta directamente en Windows. ([Electron][2])

Si:

```text
launchAtLogin = true
```

entonces:

```text
Windows login
→ Electron
→ tray
→ NO mostrar ventana principal
→ registrar hotkeys
```

Si además:

```text
administratorMode = true
```

puede aparecer UAC durante el inicio.

Aceptado como limitación de beta.

---

# 25. System Tray

Menú:

```text
Abrir
────────────
✓ Hotkeys activos
────────────
Estadísticas
Configuración
────────────
Salir
```

Doble clic icono:

```text
abrir ventana
```

Botón `X` ventana principal:

```text
hide()
```

No termina aplicación.

Solo:

```text
Tray → Salir
```

termina.

---

# 26. Una única instancia

Al inicio:

```ts
app.requestSingleInstanceLock()
```

Si ya existe:

```text
segunda instancia
→ enfocar primera
→ terminar segunda
```

Electron proporciona directamente este mecanismo. ([Electron][10])

---

# 27. Pausar

Desde tray/configuración:

```text
Hotkeys activos: ON/OFF
```

OFF:

```text
globalShortcut.setSuspended(true)
```

No elimina configuración.

No modifica DB excepto setting.

---

# 28. Edición

Tabla principal:

```text
┌──────────────────────────────────────────────────────────────┐
│ Buscar...                                      + Nuevo       │
├────┬─────────────────┬──────────────┬──────┬────────┬───────┤
│ #  │ Título          │ Hotkey       │ Slot │ Usos   │ Activo│
├────┼─────────────────┼──────────────┼──────┼────────┼───────┤
│    │ Traducir        │ Ctrl+Alt+P   │ 1    │ 942    │ ✓     │
│    │ Resumir         │ Ctrl+Alt+P   │ 2    │ 128    │ ✓     │
│    │ Corregir        │ Ctrl+Alt+P   │ 3    │ 1812   │ ✓     │
└────┴─────────────────┴──────────────┴──────┴────────┴───────┘
```

Acciones:

```text
Editar
Duplicar
Desactivar
Eliminar
```

---

# 29. Reordenamiento

Pantalla del hotkey:

```text
Ctrl + Alt + P

↕ 1  Traducir        942 usos
↕ 2  Resumir         128 usos
↕ 3  Corregir      1.812 usos
```

Drag-and-drop.

Al mover:

```text
3 → 1
```

operación transaccional:

```text
Corregir → 1
Traducir → 2
Resumir → 3
```

El contador no participa en el algoritmo.

---

# 30. Desactivar

Desactivar snippet:

```text
enabled = 0
```

Mantiene:

```text
slot
usage_count
usage_events
content
hotkey
```

No aparece en selector.

No libera slot.

---

# 31. Eliminar

Beta:

```text
soft delete
```

```text
deleted_at = now()
enabled = 0
```

Ventajas:

```text
no perdemos estadísticas
recuperación futura posible
menos riesgo
```

El slot sí queda disponible para nuevos elementos.

No necesitamos UI de papelera en V1.

---

# 32. Resolución del hotkey

```pseudo
onHotkey(accelerator):
    if state != READY:
        return

    target = GetForegroundWindow()

    snippets =
        getEnabledSnippets(accelerator)
        .sortBy(slot)

    if count == 0:
        return

    if count == 1:
        expand(target, snippets[0])
        return

    openSelector(target, snippets)
```

---

# 33. Resolución del selector

```pseudo
onSelectorKey(key):

    if key == Escape:
        close()
        return

    slot = {
        1→1,
        ...
        9→9,
        0→10
    }[key]

    snippet = snippets.find(s => s.slot == slot)

    if not snippet:
        return

    close()

    restoreTargetWindow()

    expand(snippet)
```

---

# 34. Estadísticas

Página:

```text
Total expansiones                  12.482
Hoy                                   131
Últimos 7 días                        822
Últimos 30 días                     3.145
```

Tabla:

```text
Título             Total   7 días   30 días   Último uso
Traducir            512       81       310    hoy
Corregir           1812      302       892    hoy
Prompt XYZ            7        0         0    hace 91 días
```

V1 no necesita gráficas.

La tabla aporta toda la información necesaria con menor complejidad.

---

# 35. Semántica de `usage_count`

Debe quedar documentado:

```text
usage_count ≠ prueba matemática de que la app destino incorporó el texto
```

No existe una API universal para verificar el contenido final de Word, Chrome, Notepad, VS Code, etc.

Significa:

```text
la aplicación consiguió restaurar foco
+
despachó correctamente el mecanismo de inserción
```

Eso es lo suficientemente próximo a “uso” para estas estadísticas.

---

# 36. Transacción estadística

Después de expansión exitosa:

```sql
BEGIN IMMEDIATE;

INSERT INTO usage_events(snippet_id, used_at)
VALUES (?, ?);

UPDATE snippets
SET
    usage_count = usage_count + 1,
    last_used_at = ?,
    updated_at = ?
WHERE id = ?;

COMMIT;
```

Así nunca tendremos:

```text
usage_count = 50
events = 49
```

salvo corrupción externa.

---

# 37. IPC

Única API visible al renderer:

```ts
window.appApi.snippets.list()
window.appApi.snippets.create(input)
window.appApi.snippets.update(input)
window.appApi.snippets.remove(id)
window.appApi.snippets.reorder(input)

window.appApi.hotkeys.validate(accelerator)

window.appApi.stats.summary()
window.appApi.stats.bySnippet()

window.appApi.settings.get()
window.appApi.settings.update(input)

window.appApi.runtime.pause()
window.appApi.runtime.resume()
window.appApi.runtime.quit()
```

No exponer:

```ts
ipcRenderer
fs
child_process
koffi
database
shell
```

directamente.

---

# 38. Estructura de proyecto

```text
src/
├── main/
│   ├── main.ts
│   │
│   ├── lifecycle/
│   │   ├── AppLifecycleService.ts
│   │   └── SingleInstanceService.ts
│   │
│   ├── database/
│   │   ├── Database.ts
│   │   ├── migrations/
│   │   └── repositories/
│   │       ├── SnippetRepository.ts
│   │       ├── HotkeyRepository.ts
│   │       ├── UsageRepository.ts
│   │       └── SettingsRepository.ts
│   │
│   ├── snippets/
│   │   └── SnippetService.ts
│   │
│   ├── hotkeys/
│   │   ├── HotkeyService.ts
│   │   └── HotkeyNormalizer.ts
│   │
│   ├── expansion/
│   │   ├── ExpansionService.ts
│   │   ├── ClipboardInsertionStrategy.ts
│   │   └── UnicodeInsertionStrategy.ts
│   │
│   ├── windows/
│   │   ├── WindowsInputService.ts
│   │   ├── ClipboardGuard.ts
│   │   └── AdministratorService.ts
│   │
│   ├── popup/
│   │   └── SelectorWindowService.ts
│   │
│   ├── tray/
│   │   └── TrayService.ts
│   │
│   ├── statistics/
│   │   └── StatisticsService.ts
│   │
│   └── ipc/
│       └── handlers.ts
│
├── preload/
│   └── preload.ts
│
├── renderer/
│   ├── main/
│   ├── selector/
│   └── shared/
│
└── shared/
    ├── types/
    ├── schemas/
    └── constants/
```

---

# 39. Reglas arquitectónicas

```text
Renderer → IPC → Service → Repository → SQLite
```

Nunca:

```text
Renderer → SQLite
```

Windows:

```text
ExpansionService → WindowsInputService → Win32
```

Nunca:

```text
UI → Koffi
```

Estadística:

```text
ExpansionService → StatisticsService
```

Nunca:

```text
popup → SQL
```

---

# 40. Manejo de hotkey nuevo

Cuando se guarda una combinación nunca usada:

```text
1 validar formato
2 intentar globalShortcut.register()
3 si falla → mostrar error
4 si funciona → persistir
5 si persistencia falla → unregister()
```

Nunca guardar primero y descubrir después que Windows no acepta la combinación.

---

# 41. Hotkey ya perteneciente a nuestra app

```text
Ctrl+Alt+P
```

ya existe.

Nuevo snippet con:

```text
Ctrl+Alt+P
```

No registrar otra vez.

Solo:

```text
agregar snippet al HotkeyGroup
```

---

# 42. Eliminación del último snippet de un grupo

```text
group
→ no quedan snippets activos/no eliminados
→ unregister accelerator
→ eliminar hotkey_group
```

Si quedan snippets desactivados, el grupo continúa existiendo pero no necesita estar registrado hasta que alguno vuelva a activarse.

---

# 43. Startup

Orden obligatorio:

```text
app start
→ elevation si corresponde
→ single instance
→ app.ready
→ abrir SQLite
→ migraciones
→ cargar settings
→ crear tray
→ registrar hotkeys activos
→ crear ventanas ocultas/necesarias
→ READY
```

No registrar global shortcuts antes de `app.ready`; Electron no lo permite. ([Electron][6])

---

# 44. Shutdown

```text
SHUTTING_DOWN
→ cerrar selector
→ globalShortcut.unregisterAll()
→ flush logs
→ cerrar SQLite
→ destruir tray
→ quit
```

---

# 45. Errores visibles

### Hotkey ocupado

```text
No se pudo registrar Ctrl+Alt+P.
Windows u otra aplicación ya está usando esta combinación.
```

### 10 slots ocupados

```text
Este hotkey ya tiene 10 acciones.
Libera un slot o utiliza otra combinación.
```

### Target desapareció

```text
No se pudo insertar el texto porque la ventana destino ya no está disponible.
```

### No puede recuperar foco

```text
No se pudo recuperar el foco de la aplicación destino.
No se insertó ningún texto.
```

### Elevación necesaria

```text
La aplicación destino se está ejecutando como administrador.
Reinicia esta aplicación en modo administrador.
```

---

# 46. Logging

Archivo:

```text
%APPDATA%\<AppName>\logs\app.log
```

Registrar:

```text
startup
shutdown
migration
hotkey registration failure
expansion failure
focus restoration failure
clipboard restoration failure
SQLite error
Win32 error
```

No registrar:

```text
snippet.content
clipboard content
texto escrito
```

El título puede aparecer en logs de debug, pero preferiblemente `snippetId`.

---

# 47. Seguridad

MUST:

```text
nodeIntegration = false
contextIsolation = true
sandbox = true
remote content = none
CSP restrictiva
IPC payload validation
prepared SQL statements
no eval()
no shell commands construidos con input
```

Electron recomienda este patrón de aislamiento para aplicaciones desktop. ([Electron][3])

---

# 48. Features

| Feature              | V1     |
| -------------------- | ------ |
| Crear snippet        | MUST   |
| Editar               | MUST   |
| Eliminar             | MUST   |
| Desactivar           | MUST   |
| Duplicar             | SHOULD |
| Buscar               | SHOULD |
| Global hotkeys       | MUST   |
| Shared hotkey        | MUST   |
| Selector 1–0         | MUST   |
| Manual slots         | MUST   |
| Usage count          | MUST   |
| Usage events         | MUST   |
| Stats 7/30 días      | MUST   |
| Tray                 | MUST   |
| Auto-start           | MUST   |
| Admin mode           | MUST   |
| Pause hotkeys        | MUST   |
| Clipboard protection | MUST   |
| Unicode fallback     | MUST   |
| Multi-monitor        | MUST   |
| Import/export        | LATER  |
| Backup               | LATER  |
| Variables            | LATER  |
| Cloud                | NO     |
| Auto reorder         | NO     |

---

# 49. Riesgos principales

| Riesgo                      | Consecuencia                    | Mitigación                               |
| --------------------------- | ------------------------------- | ---------------------------------------- |
| UIPI                        | no pega en apps elevadas        | modo administrador                       |
| Focus race                  | pega en ventana incorrecta      | guardar HWND + verificar antes           |
| Clipboard complejo          | pérdida clipboard               | ClipboardGuard + Unicode fallback        |
| Modificadores aún pulsados  | Ctrl+V incorrecto               | `GetAsyncKeyState`                       |
| Hotkey externo ocupado      | combinación no funciona         | probar antes de persistir                |
| SQLite/registry divergentes | configuración inconsistente     | servicios transaccionales + rebuild      |
| Popup fuera de pantalla     | selector inutilizable           | `workArea + clamp`                       |
| doble ejecución             | dos inserts                     | estado `EXPANDING`                       |
| native modules Electron     | fallo de packaging              | Forge rebuild                            |
| Electron elevado            | mayor superficie de privilegios | aceptado beta; helper en versión pública |

---

# 50. Plan de implementación

## P0 — Spike técnico

Objetivo: demostrar únicamente las partes arriesgadas.

Construir una aplicación mínima que pueda:

```text
Ctrl+Alt+P
→ capturar HWND
→ insertar "PRUEBA"
```

y:

```text
Ctrl+Alt+O
→ popup
→ seleccionar 1
→ volver al HWND anterior
→ insertar
```

Probar:

```text
Notepad
Chrome
VS Code
Word si disponible
app elevada
```

También probar:

```text
Unicode
texto de 10.000 caracteres
multimonitor
clipboard
```

**No empezar CRUD completo antes de que este spike funcione.**

Este es el orden correcto porque la automatización Windows es el mayor riesgo del proyecto.

---

## P1 — Foundation

Implementar:

```text
Electron
TypeScript
Forge
preload
IPC
single instance
SQLite
migrations
logging
```

Resultado verificable:

```text
app abre
DB se crea
segunda instancia no abre
```

---

## P2 — Snippet domain

Implementar:

```text
hotkey_groups
snippets
CRUD
slots
enabled
soft delete
```

Resultado:

```text
crear/editar/eliminar snippets persistentemente
```

---

## P3 — Hotkey engine

Implementar:

```text
captura
normalización
validación
registro
unregister
rebuild
pause/resume
```

Resultado:

```text
hotkeys sobreviven restart
hotkey ocupado produce error
```

---

## P4 — Expansion single

Implementar:

```text
target HWND
focus
modifiers released
ClipboardGuard
paste
Unicode fallback
```

Resultado:

```text
1 snippet → texto aparece sin UI intermedia
```

---

## P5 — Selector

Implementar:

```text
BrowserWindow flotante
1..9/0
Esc
click
blur
cursor positioning
multi-monitor
DPI
```

Resultado:

```text
2–10 snippets → selector correcto
```

---

## P6 — Manual slots

Implementar:

```text
drag & drop
reorder transaction
usage counter visible
```

Resultado:

```text
orden solo cambia manualmente
```

---

## P7 — Statistics

Implementar:

```text
usage_events
usage_count
last_used_at
today
7d
30d
```

Resultado:

```text
datos derivados correctamente
```

---

## P8 — Tray/settings

Implementar:

```text
Tray
startup
start hidden
pause
admin mode
settings persistence
```

---

## P9 — Hardening

Probar:

```text
hotkeys repetidos rápidamente
texto Unicode
emoji
acentos
saltos de línea
10k+ caracteres
clipboard texto
clipboard imagen
clipboard HTML
monitor secundario
DPI 100/125/150/200%
target cerrado
app elevada
sleep/resume Windows
Explorer restart
DB locked/corrupt
```

---

## P10 — Packaging beta

```text
electron-forge package
electron-forge make
→ Setup.exe
```

Squirrel.Windows puede producir un `Setup.exe` sin necesitar un instalador administrativo. ([Electron Forge][11])

Firma:

```text
OUT beta
```

---

# 51. Criterios de aceptación

La beta se considera terminada únicamente si pasan todos:

1. Crear snippet con título, texto y hotkey.
2. Reiniciar Windows/app y conservarlo.
3. Hotkey funciona con app oculta.
4. Un solo snippet se ejecuta sin popup.
5. 2–10 snippets muestran popup.
6. `1..9,0` ejecutan el slot correspondiente.
7. Estadísticas jamás cambian slots.
8. Desactivar un snippet no renumera otros.
9. Eliminar un snippet no renumera otros.
10. Máximo 10 slots por hotkey.
11. Popup nunca sale del `workArea`.
12. Funciona en segundo monitor.
13. Funciona con DPI distinto.
14. `Esc` no inserta nada.
15. Perder/cerrar target no pega en otra ventana.
16. Portapapeles previo no se destruye.
17. Si el clipboard no puede preservarse, se usa fallback sin modificarlo.
18. Unicode español funciona: `áéíóúñ¿¡`.
19. Emoji funciona.
20. Saltos de línea funcionan.
21. Prompt largo funciona.
22. Hotkey ocupado muestra error.
23. Dos snippets pueden compartir hotkey.
24. `usage_count` aumenta exactamente una vez por expansión despachada.
25. Una expansión fallida no incrementa contador.
26. `usage_events` permite métricas 7/30 días.
27. Inicio con Windows es configurable.
28. Inicio automático ocurre oculto en tray.
29. `X` oculta, no termina.
30. Tray → Salir termina realmente.
31. Solo existe una instancia.
32. Pausar desactiva todos los shortcuts sin eliminarlos.
33. Modo administrador funciona con una app destino elevada.
34. Restart no modifica orden.
35. Ningún renderer tiene acceso directo a Node/SQLite/Win32.

---

# 52. Definition of Done técnica

Cada fase solo está terminada si:

```text
TypeScript compila sin errores
lint pasa
tests pasan
sin SQL ad-hoc desde UI
sin Node en renderer
errores controlados
logs sin contenido sensible
migración incluida si cambia DB
caso feliz probado
caso de error probado
```

---

# 53. Decisiones abiertas

**Ninguna que bloquee implementación.**

Quedan decisiones reversibles:

```text
nombre del programa
icono
tipografía
colores
ancho exacto del popup
spacing
nombre visual de las secciones
```

Un programador no debe detenerse para preguntar nada de eso.

La primera tarea de desarrollo debería ser **P0, no la interfaz administrativa**. Si `GetForegroundWindow → popup → SetForegroundWindow → inserción` no es fiable, todo el producto pierde su función central; por eso ese mecanismo debe validarse antes de invertir tiempo en CRUD, estadísticas o diseño visual.

[1]: https://www.electronjs.org/docs/latest/api/clipboard?utm_source=chatgpt.com "clipboard | Electron"
[2]: https://www.electronjs.org/es/docs/latest/api/app?utm_source=chatgpt.com "app | Electron"
[3]: https://www.electronjs.org/docs/latest/tutorial/security?utm_source=chatgpt.com "Security | Electron"
[4]: https://www.electronjs.org/docs/latest/tutorial/using-native-node-modules/?utm_source=chatgpt.com "Native Node Modules | Electron"
[5]: https://koffi.dev/start?utm_source=chatgpt.com "Get started | Koffi"
[6]: https://www.electronjs.org/docs/latest/api/global-shortcut/?utm_source=chatgpt.com "globalShortcut | Electron"
[7]: https://www.electronjs.org/docs/latest/api/browser-window/?utm_source=chatgpt.com "BrowserWindow | Electron"
[8]: https://www.electronjs.org/docs/latest/api/screen?utm_source=chatgpt.com "screen | Electron"
[9]: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-sendinput?utm_source=chatgpt.com "SendInput function (winuser.h) - Win32 apps | Microsoft Learn"
[10]: https://www.electronjs.org/docs/latest/api/app?utm_source=chatgpt.com "app | Electron"
[11]: https://www.electronforge.io/config/makers/squirrel.windows?utm_source=chatgpt.com "Squirrel.Windows | Electron Forge"
