// src/services/priority-lanes.ts
// NÚCLEO PURO del posicionamiento de HIGH/URGENT dentro de la cola de un diseñador.
//
// Modelo (lo que el usuario pidió): HIGH y URGENT NO arrancan "de inmediato" — se INSERTAN
// EN PARALELO (misma fecha de INICIO) a una tarea de la "cola base" (las de MENOR prioridad,
// ordenadas por inicio). Contando desde la que está EN CURSO (índice 0):
//
//   • URGENT → base[1 + nºURGENT_ya] :  1º→base[1] (la PRÓXIMA), 2º→base[2], 3º→base[3]…
//   • HIGH   → base[2 + 2·nºHIGH_ya] :  1º→base[2] (la 2ª), 2º→base[4] (la 4ª, dejando una)…
//
//   Ej. cola N1(curso) N2 N3 N4 N5:
//     1ª HIGH  → paralela a N3;  2ª HIGH → paralela a N5 (deja N4).
//     1º URGENT→ paralela a N2;  2º URGENT→ paralela a N3.
//     URGENT y luego HIGH → U1‖N2, H1‖N3.
//
// Si esa posición no existe (cola base corta) la tarea va TRAS la última tarea del diseñador
// (o inmediata si no tiene ninguna). NORMAL/LOW NO usan esto (siguen el modelo de carril).
import { Priority } from '@/db/enums';

const RANK: Record<Priority, number> = { LOW: 1, NORMAL: 2, HIGH: 3, URGENT: 4 };

export interface LaneTask {
  id: string;
  name: string;
  startDate: Date;
  deadline: Date;
  priority: Priority;
}

export type LanePlacement =
  | { mode: 'parallel'; anchor: LaneTask } // misma fecha de INICIO que `anchor`
  | { mode: 'after'; anchor: LaneTask } // tras el deadline de `anchor` (la última tarea)
  | { mode: 'immediate' }; // el diseñador no tiene tareas: empieza ya

/**
 * Decide dónde arranca una tarea de prioridad HIGH/URGENT dentro de `tasks` (todas las
 * tareas activas del diseñador, en cualquier orden). Ver el modelo arriba. PURO.
 */
export function resolvePriorityPlacement(tasks: LaneTask[], priority: Priority): LanePlacement {
  const rank = RANK[priority];

  // Cola base = tareas de MENOR prioridad, ordenadas por fecha de inicio ascendente.
  const base = tasks
    .filter((t) => RANK[t.priority] < rank)
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // Cuántas del MISMO nivel ya tiene → corre el ancla una/dos posiciones por cada una.
  const sameCount = tasks.filter((t) => RANK[t.priority] === rank).length;

  // URGENT avanza de 1 en 1 desde la próxima; HIGH de 2 en 2 desde la 2ª (deja una).
  const targetIdx = rank >= RANK.URGENT ? 1 + sameCount : 2 + 2 * sameCount;

  const anchor = base[targetIdx];
  if (anchor) return { mode: 'parallel', anchor };

  // No hay tarea base en esa posición → al final (tras la última) o inmediata.
  if (tasks.length > 0) {
    const last = tasks.reduce((a, b) => (a.deadline.getTime() >= b.deadline.getTime() ? a : b));
    return { mode: 'after', anchor: last };
  }
  return { mode: 'immediate' };
}
