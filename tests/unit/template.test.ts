import { describe, expect, test } from 'bun:test';
import { TemplateEngine } from '../../src/main/expansion/TemplateEngine';

describe('TemplateEngine', () => {
  test('returns plain text unchanged when no dynamic tags exist', () => {
    const text = 'Texto simple sin variables';
    expect(TemplateEngine.render(text)).toBe(text);
  });

  test('replaces date and time variables accurately', () => {
    const fixedDate = new Date(2026, 7, 31, 15, 45, 9); // 2026-08-31 15:45:09
    const template = 'Fecha: {{date}} | Hora: {{time}} | Completo: {{datetime}}';

    const rendered = TemplateEngine.render(template, { date: fixedDate });

    expect(rendered).toBe('Fecha: 2026-08-31 | Hora: 15:45:09 | Completo: 2026-08-31 15:45:09');
  });

  test('replaces individual date component variables with zero padding', () => {
    const fixedDate = new Date(2026, 0, 5, 8, 4, 3); // 2026-01-05 08:04:03
    const template = '{{year}}/{{month}}/{{day}} {{hour}}:{{minute}}:{{second}}';

    const rendered = TemplateEngine.render(template, { date: fixedDate });

    expect(rendered).toBe('2026/01/05 08:04:03');
  });

  test('replaces {{clipboard}} with the provided clipboard text', () => {
    const template = 'Respuesta a: {{clipboard}} - Gracias!';
    const rendered = TemplateEngine.render(template, {
      clipboardText: 'Ticket #4092'
    });

    expect(rendered).toBe('Respuesta a: Ticket #4092 - Gracias!');
  });

  test('handles spaces inside brackets and case insensitivity', () => {
    const fixedDate = new Date(2026, 7, 31, 12, 0, 0);
    const template = 'Fecha: {{  DATE  }} - Portapapeles: {{   ClipBoard }}';

    const rendered = TemplateEngine.render(template, {
      date: fixedDate,
      clipboardText: 'Contenido Copiado'
    });

    expect(rendered).toBe('Fecha: 2026-08-31 - Portapapeles: Contenido Copiado');
  });

  test('leaves unrecognized tags untouched', () => {
    const template = 'Hola {{nombre}}, hoy es {{date}} y tu código es {{custom_token}}';
    const fixedDate = new Date(2026, 7, 31, 10, 0, 0);

    const rendered = TemplateEngine.render(template, { date: fixedDate });

    expect(rendered).toBe('Hola {{nombre}}, hoy es 2026-08-31 y tu código es {{custom_token}}');
  });
});
