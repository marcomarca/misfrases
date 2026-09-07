import { beforeEach, describe, expect, test } from 'bun:test';
import { AppDatabase } from '../../src/main/database/Database';
import { ContextBlockRepository } from '../../src/main/database/repositories/ContextBlockRepository';

describe('ContextBlockRepository & Migration v3', () => {
  let db: AppDatabase;
  let repo: ContextBlockRepository;

  beforeEach(() => {
    db = new AppDatabase(':memory:');
    repo = new ContextBlockRepository(db.getRawDb());
  });

  test('seeds 4 default context blocks on initial database creation', () => {
    const blocks = repo.listAll();
    expect(blocks.length).toBe(4);

    const keys = blocks.map((b) => b.key).sort();
    expect(keys).toEqual(['perfil_base', 'principios_arquitectura', 'stack_hardware', 'stack_software']);

    const perfil = repo.getByKey('perfil_base');
    expect(perfil).not.toBeNull();
    expect(perfil?.title).toBe('Perfil Base');
    expect(perfil?.content).toContain('Ingeniero Electrónico');

    const stackSw = repo.getByKey('stack_software');
    expect(stackSw?.content).toContain('Bun');

    const stackHw = repo.getByKey('stack_hardware');
    expect(stackHw?.content).toContain('ESP32');

    const principios = repo.getByKey('principios_arquitectura');
    expect(principios?.content).toContain('Simplicidad');
  });

  test('getAllAsMap returns normalized lowercase mapping of keys to contents', () => {
    const map = repo.getAllAsMap();
    expect(Object.keys(map).length).toBe(4);
    expect(map['perfil_base']).toContain('Ingeniero');
    expect(map['stack_software']).toBeDefined();
    expect(map['stack_hardware']).toBeDefined();
    expect(map['principios_arquitectura']).toBeDefined();
  });

  test('creates a new context block and prevents duplicates', () => {
    const block = repo.create({
      key: 'directrices_seguridad',
      title: 'Directrices de Seguridad',
      content: 'Principio de menor privilegio y sanitización de entradas.'
    });

    expect(block.id).toBeDefined();
    expect(block.key).toBe('directrices_seguridad');
    expect(block.title).toBe('Directrices de Seguridad');
    expect(block.content).toContain('menor privilegio');

    const retrieved = repo.getById(block.id);
    expect(retrieved?.id).toBe(block.id);

    // Duplicate key should throw
    expect(() => {
      repo.create({
        key: 'directrices_seguridad',
        title: 'Otra',
        content: 'Contenido duplicado'
      });
    }).toThrow(/Ya existe un bloque/);

    // Duplicate key with different case should also throw
    expect(() => {
      repo.create({
        key: 'DIRECTRICES_SEGURIDAD',
        title: 'Otra Mayúsculas',
        content: 'Contenido'
      });
    }).toThrow(/Ya existe un bloque/);
  });

  test('updates context block title, content, and key', () => {
    const block = repo.create({
      key: 'temp_key',
      title: 'Temp Title',
      content: 'Original content'
    });

    const updated = repo.update({
      id: block.id,
      key: 'renamed_key',
      title: 'Updated Title',
      content: 'New content'
    });

    expect(updated.key).toBe('renamed_key');
    expect(updated.title).toBe('Updated Title');
    expect(updated.content).toBe('New content');

    // Trying to rename to existing key throws
    expect(() => {
      repo.update({
        id: block.id,
        key: 'perfil_base'
      });
    }).toThrow(/Ya existe un bloque/);
  });

  test('removes a context block by ID', () => {
    const block = repo.create({
      key: 'to_delete',
      title: 'To Delete',
      content: 'Will be deleted'
    });

    expect(repo.getById(block.id)).not.toBeNull();
    const removed = repo.remove(block.id);
    expect(removed).toBe(true);
    expect(repo.getById(block.id)).toBeNull();
  });

  test('bulkUpsert updates existing blocks and inserts new blocks without conflict', () => {
    const backupBlocks = [
      {
        id: 'cb-default-perfil-base',
        key: 'perfil_base',
        title: 'Perfil Base Modificado',
        content: 'Contenido nuevo de perfil restaurado de backup',
        createdAt: 1000,
        updatedAt: 2000
      },
      {
        id: 'cb-custom-nuevo',
        key: 'bloque_nuevo',
        title: 'Bloque Nuevo',
        content: 'Contexto extra',
        createdAt: 3000,
        updatedAt: 3000
      }
    ];

    repo.bulkUpsert(backupBlocks);

    const perfil = repo.getByKey('perfil_base');
    expect(perfil?.title).toBe('Perfil Base Modificado');
    expect(perfil?.content).toBe('Contenido nuevo de perfil restaurado de backup');

    const nuevo = repo.getByKey('bloque_nuevo');
    expect(nuevo).not.toBeNull();
    expect(nuevo?.title).toBe('Bloque Nuevo');
    expect(repo.listAll().length).toBe(5);
  });
});
