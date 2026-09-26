'use client';

import { type ReactNode } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { PencilEdit02Icon, Delete02Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/shadcn/button';
import type { DataTableColumn } from './DataTable';

/**
 * Helper que devuelve la columna canónica de "acciones de fila" (Edit/Delete)
 * usada por las tablas CRUD. Encapsula la convención (priority/width/skeleton).
 */
export interface ActionsColumnOptions<T> {
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  /** Nodos extra a la DERECHA de Edit/Delete (Duplicate, Download, etc.). */
  extra?: (row: T) => ReactNode;
  key?: string;
  width?: number;
  editLabel?: string;
  deleteLabel?: string;
}

export function actionsColumn<T>({
  onEdit,
  onDelete,
  extra,
  key = 'actions',
  width = 220,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
}: ActionsColumnOptions<T>): DataTableColumn<T> {
  return {
    key,
    header: '',
    priority: 5,
    align: 'right',
    width,
    expandedBare: true,
    skeleton: 'actions',
    cell: (row: T) => (
      <div className="flex items-center justify-end gap-2">
        {onEdit && (
          <Button size="sm" variant="soft" onClick={() => onEdit(row)}>
            <HugeiconsIcon icon={PencilEdit02Icon} size={14} />
            {editLabel}
          </Button>
        )}
        {onDelete && (
          <Button
            size="sm"
            variant="soft"
            className="bg-destructive/15 text-destructive hover:bg-destructive/20"
            onClick={() => onDelete(row)}
          >
            <HugeiconsIcon icon={Delete02Icon} size={14} />
            {deleteLabel}
          </Button>
        )}
        {extra?.(row)}
      </div>
    ),
  };
}
