export interface TemplateContext {
  date?: Date;
  clipboardText?: string;
  contextBlocks?: Record<string, string>;
}

export class TemplateEngine {

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
