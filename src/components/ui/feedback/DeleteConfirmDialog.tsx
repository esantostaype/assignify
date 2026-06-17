'use client';

import { AlertDialog } from './AlertDialog';

export interface DeleteConfirmDialogProps {
  open: boolean;
  /** Fires when the user dismisses without confirming (Cancel,
   *  backdrop click, or ESC). */
  onClose: () => void;
  /** Fires when the user confirms the delete.  Parent removes the
   *  record + closes the dialog. */
  onConfirm: () => void;
  /** Friendly name of the row being removed — quoted in the
   *  description copy ("Acme Pop-Up Markets will be removed…").
   *  Optional; when missing, the description uses the generic
   *  "This {itemKind}" form. */
  itemName?: string;
  /** Type/category for the item (`'quote'`, `'questionnaire'`,
   *  `'payroll record'`, `'location'`).  Used in the title and as
   *  a fallback in the description.  Defaults to `'item'`. */
  itemKind?: string;
  /** Override the heading entirely.  When set, `itemKind` is ignored
   *  in the title (still used in the description fallback). */
  title?: string;
  /** Override the body copy entirely.  When set, `itemName` /
   *  `itemKind` are ignored in the description. */
  description?: string;
  /** Override the confirm button label.  Default is `Delete`
   *  (decisive — pairs with "cannot be undone").  Use `Remove` when
   *  the action just disassociates a row from a parent record
   *  (e.g. removing a location from a quote draft). */
  confirmLabel?: string;
  /** Override the cancel button label.  Default `Cancel`. */
  cancelLabel?: string;
}

/**
 * Standard "Delete this record?" confirmation — shared across every
 * list-style surface that exposes a row remove (Quotes, Payroll,
 * Questionnaires, Locations…).  Wraps `AlertDialog` with the danger
 * tone, the canonical copy and a single `Delete` confirm so the
 * warning reads identically wherever it fires.
 *
 *   • Tone           — `danger` (red circle + red filled Delete button)
 *   • Title          — `"Delete this {itemKind}?"`
 *   • Description    — `"{itemName} will be removed from the list.
 *                       This action cannot be undone."`
 *   • Confirm label  — `Delete`
 *   • Cancel label   — `Cancel`
 *
 * Every copy slot is overrideable so a specific row type can swap
 * the heading or button label without forking the component.
 */
export function DeleteConfirmDialog({
  open, onClose, onConfirm,
  itemName,
  itemKind = 'item',
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel  = 'Cancel',
}: DeleteConfirmDialogProps) {
  const resolvedTitle =
    title ?? `Delete this ${itemKind}?`;

  const resolvedDescription =
    description ?? (itemName
      ? `${itemName} will be removed from the list.  This action cannot be undone.`
      : `This ${itemKind} will be removed from the list.  This action cannot be undone.`);

  return (
    <AlertDialog
      open={open}
      onClose={onClose}
      tone="danger"
      title={resolvedTitle}
      description={resolvedDescription}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={onConfirm}
      // Surface the wrapper name in the Dev Mode inspector — keeps
      // the canonical "Delete" dialog identifiable as a first-class
      // entity instead of as the underlying AlertDialog primitive.
      dataComponentName="DeleteConfirmDialog"
    />
  );
}
