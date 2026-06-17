// src/components/ConfirmDeleteModal.tsx
import React from 'react';
import { Button } from '@/components/ui';
import { Icon, PiTrash, PiX } from '@/lib/icons';

interface ConfirmDeleteModalProps {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  title,
  description,
  onConfirm,
  onCancel,
  loading = false
}) => {
  return (
    <div className="p-6 space-y-4">
      <div className="space-y-2">
        <h3 className="text-lg font-medium text-(--color-text-default)">{title}</h3>
        <p className="text-(--color-text-muted)">{description}</p>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <Button
          variant="soft"
          color="neutral"
          onClick={onCancel}
          disabled={loading}
          startIcon={<Icon icon={PiX} size={16} />}
        >
          Cancel
        </Button>
        <Button
          variant="filled"
          color="error"
          onClick={onConfirm}
          loading={loading}
          disabled={loading}
          startIcon={<Icon icon={PiTrash} size={16} />}
        >
          Delete
        </Button>
      </div>
    </div>
  );
};
