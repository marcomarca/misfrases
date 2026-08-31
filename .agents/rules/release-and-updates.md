# Reglas del Repositorio: Auto-Actualizaciones y Publicación

Al trabajar en este proyecto (`mis-frases`), cualquier agente de IA DEBE cumplir estrictamente:

1. **Preservación de Auto-Update:**
   - Mantener siempre [AutoUpdateService.ts](file:///d:/apps-nodejs/mis-frases/src/main/lifecycle/AutoUpdateService.ts) y su inicialización en `AppLifecycleService.ts`.
   - Mantener la dependencia `update-electron-app` y la configuración de `PublisherGithub` en `forge.config.ts`.

2. **Publicación Completa de Releases:**
   - Al publicar una versión en GitHub Releases, subir **todos** los archivos generados por `bun run make`: `Setup.exe`, `RELEASES`, `.nupkg` y `.zip`.
   - Nunca omitir `RELEASES` ni los `.nupkg`, ya que son el canal de actualización que leen los clientes existentes.

3. **Inicio Silencioso de Windows:**
   - Mantener [LoginItemService.ts](file:///d:/apps-nodejs/mis-frases/src/main/lifecycle/LoginItemService.ts) configurado con `--hidden` en producción y desactivado en modo desarrollo.

4. **Documentación y Versionado:**
   - Actualizar siempre [CHANGELOG.md](file:///d:/apps-nodejs/mis-frases/CHANGELOG.md) e incrementar la versión en [package.json](file:///d:/apps-nodejs/mis-frases/package.json) según SemVer.

Para el procedimiento paso a paso completo, consultar la skill [auto-update-and-release](file:///d:/apps-nodejs/mis-frases/.agents/skills/auto-update-and-release/SKILL.md).
