import { z } from 'zod';
import type { SlotNumber } from '../types';

export const SlotNumberSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(7),
  z.literal(8),
  z.literal(9),
  z.literal(10)
]) as z.ZodType<SlotNumber>;

export const CreateSnippetSchema = z.object({
  title: z.string().trim().min(1, 'El título es obligatorio').max(120, 'Máximo 120 caracteres'),
  description: z.string().trim().max(300, 'Máximo 300 caracteres').optional().default(''),
  content: z.string().min(1, 'El contenido es obligatorio'),
  accelerator: z.string().trim().min(1, 'El atajo de teclado es obligatorio'),
  slot: SlotNumberSchema.optional(),
  enabled: z.boolean().optional().default(true),
});

export const UpdateSnippetSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(300).optional(),
  content: z.string().min(1).optional(),
  accelerator: z.string().trim().min(1).optional(),
  slot: SlotNumberSchema.optional(),
  enabled: z.boolean().optional(),
});

export const ReorderSnippetsSchema = z.object({
  hotkeyGroupId: z.string().min(1),
  orderedSnippetIds: z.array(z.string().min(1)).min(1).max(10),
});

export const UpdateSettingsSchema = z.object({
  launchAtLogin: z.boolean().optional(),
  administratorMode: z.boolean().optional(),
  hotkeysEnabled: z.boolean().optional(),
  startHidden: z.boolean().optional(),
  theme: z.enum(['dark', 'light', 'system']).optional()
});

export const ValidateHotkeySchema = z.object({
  accelerator: z.string().trim().min(1),
});

export const BackupSnippetSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(300).optional().default(''),
  content: z.string().min(1),
  slot: SlotNumberSchema,
  enabled: z.boolean().optional().default(true),
  accelerator: z.string().trim().min(1),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional()
});

export const BackupDataSchema = z.object({
  version: z.string().optional().default('1.0'),
  exportedAt: z.number().optional().default(() => Date.now()),
  snippets: z.array(BackupSnippetSchema)
});

export const ImportBackupOptionsSchema = z.object({
  mode: z.enum(['merge', 'replace']).optional().default('merge')
});
