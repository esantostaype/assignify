import { describe, it, expect } from 'vitest';
import { resolvePriorityPlacement, type LaneTask } from './priority-lanes';
import type { Priority } from '@/db/enums';

// Helper: una tarea que empieza el día `d` de enero 2025 (horario laboral UTC ficticio).
function task(name: string, priority: Priority, d: number): LaneTask {
  return {
    id: name,
    name,
    startDate: new Date(Date.UTC(2025, 0, d, 15, 0, 0)),
    deadline: new Date(Date.UTC(2025, 0, d, 23, 0, 0)),
    priority,
  };
}

const N = 'NORMAL' as Priority;
const H = 'HIGH' as Priority;
const U = 'URGENT' as Priority;

/** Nombre del ancla si el placement es paralelo (helper para aserciones legibles). */
function parallelAnchor(tasks: LaneTask[], p: Priority): string | null {
  const placement = resolvePriorityPlacement(tasks, p);
  return placement.mode === 'parallel' ? placement.anchor.name : null;
}

describe('resolvePriorityPlacement — HIGH/URGENT en paralelo', () => {
  // Cola base: N1 (en curso) N2 N3 N4 N5.
  const queue = () => [task('N1', N, 1), task('N2', N, 2), task('N3', N, 3), task('N4', N, 4), task('N5', N, 5)];

  it('1ª HIGH → paralela a N3 (la 2ª en cola)', () => {
    expect(parallelAnchor(queue(), H)).toBe('N3');
  });

  it('2ª HIGH → paralela a N5 (la 4ª, dejando N4)', () => {
    const withH1 = [...queue(), task('H1', H, 3)];
    expect(parallelAnchor(withH1, H)).toBe('N5');
  });

  it('1º URGENT → paralelo a N2 (la próxima)', () => {
    expect(parallelAnchor(queue(), U)).toBe('N2');
  });

  it('2º URGENT → paralelo a N3', () => {
    const withU1 = [...queue(), task('U1', U, 2)];
    expect(parallelAnchor(withU1, U)).toBe('N3');
  });

  it('URGENT y luego HIGH: U1‖N2, H1‖N3', () => {
    expect(parallelAnchor(queue(), U)).toBe('N2');
    const withU1 = [...queue(), task('U1', U, 2)];
    expect(parallelAnchor(withU1, H)).toBe('N3');
  });

  it('un HIGH no corre la posición de un URGENT (base = solo menor prioridad)', () => {
    // Con un HIGH ya presente, el 1º URGENT sigue yendo a la próxima Normal (N2).
    const withH1 = [...queue(), task('H1', H, 3)];
    expect(parallelAnchor(withH1, U)).toBe('N2');
  });

  it('cola base demasiado corta → after (tras la última tarea)', () => {
    const two = [task('N1', N, 1), task('N2', N, 2)]; // HIGH pediría base[2], no existe
    const placement = resolvePriorityPlacement(two, H);
    expect(placement.mode).toBe('after');
    if (placement.mode === 'after') expect(placement.anchor.name).toBe('N2');
  });

  it('diseñador sin tareas → immediate', () => {
    expect(resolvePriorityPlacement([], H).mode).toBe('immediate');
  });
});
