// src/components/Confirmation.tsx
// Adaptador: conecta el confirmationStore global con el <Modal> de /components/ui.
// (Antes era una implementación propia con framer-motion; ahora usa la librería.)
'use client'

import React from 'react'
import { useConfirmationStore } from '@/stores/confirmationStore'
import { Modal, Button } from '@/components/ui'
import type { ButtonColor } from '@/components/ui'
import { Icon, PiX, PiTrash, PiWarning, PiWarningCircle, PiInfo, type IconComponent } from '@/lib/icons'

interface ToneCfg {
  icon: IconComponent
  bg: string
  color: string
  button: ButtonColor
  confirmIcon?: IconComponent
}

function toneOf(type?: string): ToneCfg {
  switch (type) {
    case 'danger':
      return { icon: PiWarningCircle, bg: 'bg-error-100', color: 'text-error-600', button: 'error', confirmIcon: PiTrash }
    case 'info':
      return { icon: PiInfo, bg: 'bg-primary-100', color: 'text-primary-600', button: 'primary' }
    case 'warning':
    default:
      return { icon: PiWarning, bg: 'bg-warning-100', color: 'text-warning-600', button: 'warning' }
  }
}

export const GlobalConfirmation: React.FC = () => {
  const {
    isOpen,
    title,
    description,
    type,
    confirmText,
    cancelText,
    onConfirm,
    loading,
    closeConfirmation,
    setLoading,
  } = useConfirmationStore()

  const tone = toneOf(type)

  const handleConfirm = async () => {
    if (!onConfirm) return
    setLoading(true)
    try {
      await onConfirm()
      closeConfirmation()
    } catch (error) {
      console.error('Confirmation action failed:', error)
      setLoading(false)
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={() => {
        if (!loading) closeConfirmation()
      }}
      size="sm"
      className="!max-w-[420px]"
      density="compact"
      staticBackdrop={loading}
      closeButtonVariant="ghost"
      closeButtonSize="sm"
      closeButtonOffset="corner"
      header={
        <div className="flex items-start gap-3">
          <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-full ${tone.bg} ${tone.color}`}>
            <Icon icon={tone.icon} size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-(--color-text-strong)">{title}</p>
            {description && <p className="mt-1 text-sm text-(--color-text-muted)">{description}</p>}
          </div>
        </div>
      }
      footer={
        <>
          <Button
            variant="soft"
            color="neutral"
            onClick={closeConfirmation}
            disabled={loading}
            startIcon={<Icon icon={PiX} size={14} />}
          >
            {cancelText}
          </Button>
          <Button
            color={tone.button}
            onClick={handleConfirm}
            loading={loading}
            disabled={loading}
            startIcon={tone.confirmIcon ? <Icon icon={tone.confirmIcon} size={14} /> : undefined}
          >
            {confirmText}
          </Button>
        </>
      }
    />
  )
}
