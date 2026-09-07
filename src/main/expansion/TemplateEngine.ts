export interface TemplateContext {
  date?: Date;
  clipboardText?: string;
  contextBlocks?: Record<string, string>;
}

export interface TemplateVariableInfo {
  tag: string;
  label: string;
  description: string;
}

export class TemplateEngine {
  public static readonly AVAILABLE_VARIABLES: TemplateVariableInfo[] = [
    { tag: '{{date}}', label: 'Fecha', description: 'Fecha actual en formato YYYY-MM-DD (ej: 2026-08-31)' },
    { tag: '{{time}}', label: 'Hora', description: 'Hora actual en formato HH:mm:ss (ej: 14:30:00)' },
    { tag: '{{datetime}}', label: 'Fecha y Hora', description: 'Fecha y hora combinadas (ej: 2026-08-31 14:30:00)' },
    { tag: '{{year}}', label: 'Año', description: 'Año actual con 4 dígitos (ej: 2026)' },
    { tag: '{{month}}', label: 'Mes', description: 'Mes con 2 dígitos (01-12)' },
    { tag: '{{day}}', label: 'Día', description: 'Día del mes con 2 dígitos (01-31)' },
    { tag: '{{hour}}', label: 'Hora (hh)', description: 'Hora en formato 24h con 2 dígitos (00-23)' },
    { tag: '{{minute}}', label: 'Minuto', description: 'Minuto actual con 2 dígitos (00-59)' },
    { tag: '{{clipboard}}', label: 'Portapapeles', description: 'Texto actualmente copiado en el portapapeles' }
  ];

  /**
   * Evaluates and replaces dynamic variable tags and context block tags inside a snippet template.
   */
  public static render(template: string, context?: TemplateContext): string {
    if (!template || !template.includes('{{')) {
      return template;
    }

    const now = context?.date || new Date();
    const clipboardText = context?.clipboardText ?? '';
    const contextBlocks = context?.contextBlocks || {};

    const pad = (n: number): string => n.toString().padStart(2, '0');

    const year = now.getFullYear().toString();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hour = pad(now.getHours());
    const minute = pad(now.getMinutes());
    const second = pad(now.getSeconds());

    const dateStr = `${year}-${month}-${day}`;
    const timeStr = `${hour}:${minute}:${second}`;
    const datetimeStr = `${dateStr} ${timeStr}`;

    const variableMap: Record<string, string> = {
      date: dateStr,
      time: timeStr,
      datetime: datetimeStr,
      year,
      month,
      day,
      hour,
      minute,
      second,
      clipboard: clipboardText
    };

    return template.replace(/{{\s*(?:context\s*:\s*|@)?([a-zA-Z0-9_-]+)\s*}}/g, (match, rawKey) => {
      const normalizedKey = rawKey.toLowerCase();

      // 1. Check built-in variables (date, time, clipboard, etc.)
      if (normalizedKey in variableMap) {
        return variableMap[normalizedKey];
      }

      // 2. Check context blocks (e.g. {{context:perfil_base}}, {{@perfil_base}}, {{perfil_base}})
      if (normalizedKey in contextBlocks) {
        return contextBlocks[normalizedKey];
      }

      return match;
    });
  }
}
