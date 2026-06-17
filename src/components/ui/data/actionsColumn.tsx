'use client';

import { type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Icon, PiPencilSimple, PiTrash } from '@/lib/icons';
import type { DataTableColumn } from './DataTable';

/**
 * Helper that returns the canonical "row actions" column config used by every
 * CRUD-style table in the intranet (Quotes, Payroll, Questionnaires, Written
 * Totals).  Encapsulates the convention so consumers don't have to remember
 * the priority / width / expandedBare / skeleton tuple on every call.
 *
 * Convention (applied automatically):
 *   • `priority: 5`     — highest priority so the column survives every
 *                         auto-hide pass.  Only when the viewport genuinely
 *                         can't fit any text column does the algorithm drop
 *                         it into the expand panel.
 *   • `width: 220`      — enough for `Edit + Delete` side by side without
 *                         pushing the column wider than necessary.
 *   • `align: 'right'`  — actions anchor on the trailing edge of the row.
 *   • `expandedBare`    — when auto-hidden into the expand panel, render
 *                         the buttons as loose tappable CTAs (not chip-
 *                         wrapped) so they stay primary-action shaped.
 *   • `skeleton: 'actions'` — paints two button-shaped placeholders during
 *                         loading so the row height doesn't snap when data
 *                         lands.
 *
 * Call sites typically look like:
 *
 *   columns={[
 *     …data columns…,
 *     actionsColumn<Row>({
 *       onEdit:   (row) => openEdit(row),
 *       onDelete: (row) => setPendingDelete(row),
 *     }),
 *   ]}
 *
 * Pass `extra` to slot extra buttons after Edit/Delete (e.g. Duplicate,
 * Download).  Pass `editLabel` / `deleteLabel` to override the canonical
 * copy when the action means something subtly different ("Remove" instead
 * of "Delete" when the row is being disassociated rather than destroyed).
 */
export interface ActionsColumnOptions<T> {
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  /** Extra action nodes rendered to the RIGHT of Edit/Delete inside the
   *  same flex track.  Use for Duplicate, Download, etc. */
  extra?: (row: T) => ReactNode;
  /** Override the column key. Default `'actions'`. */
  key?: string;
  /** Override the column width.  Default `220` (fits Edit + Delete). */
  width?: number;
  /** Override the Edit button label. Default `'Edit'`. */
  editLabel?: string;
  /** Override the Delete button label.  Use `'Remove'` when the action
   *  detaches the row from a parent record (e.g. a location from a draft
   *  quote) rather than destroying it. */
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
          <Button
            size="sm"
            variant="soft"
            color="primary"
            startIcon={<Icon icon={PiPencilSimple} />}
            onClick={() => onEdit(row)}
          >
            {editLabel}
          </Button>
        )}
        {onDelete && (
          <Button
            size="sm"
            variant="soft"
            color="error"
            startIcon={<Icon icon={PiTrash} />}
            onClick={() => onDelete(row)}
          >
            {deleteLabel}
          </Button>
        )}
        {extra?.(row)}
      </div>
    ),
  };
}
