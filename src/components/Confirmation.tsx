/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/Confirmation.tsx
'use client'

import React, { useEffect } from 'react'
import { useConfirmationStore } from '@/stores/confirmationStore'
import { Icon, PiX, PiTrash, PiWarning, PiInfo, type IconComponent } from '@/lib/icons'
import { motion, AnimatePresence, Variants } from 'framer-motion'
import { Button } from '@/components/ui'
import type { ButtonColor } from '@/components/ui'

const customEase = [0.32, 0.72, 0, 1] as const

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3, ease: customEase as any }
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.3, ease: customEase }
  }
}

const confirmationVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
    y: 50
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
      mass: 0.5
    }
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: 50,
    transition: { duration: 0.2, ease: customEase }
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
    setLoading
  } = useConfirmationStore()

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        closeConfirmation()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, closeConfirmation])

  const handleConfirm = async () => {
    if (onConfirm) {
      setLoading(true)
      try {
        await onConfirm()
        closeConfirmation()
      } catch (error) {
        console.error('Confirmation action failed:', error)
        setLoading(false)
      }
    }
  }

  const getIcon = (): IconComponent => {
    switch (type) {
      case 'danger': return PiTrash
      case 'warning': return PiWarning
      case 'info': return PiInfo
      default: return PiWarning
    }
  }

  const getButtonColor = (): ButtonColor => {
    switch (type) {
      case 'danger': return 'error'
      case 'warning': return 'warning'
      case 'info': return 'primary'
      default: return 'error'
    }
  }

  const getIconColor = () => {
    switch (type) {
      case 'danger': return 'text-error-500'
      case 'warning': return 'text-warning-500'
      case 'info': return 'text-primary-500'
      default: return 'text-error-500'
    }
  }

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center">
          {/* Higher z-index backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/60"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={closeConfirmation}
          />

          {/* Confirmation Dialog */}
          <motion.div
            className="relative w-full max-w-md mx-4 bg-(--color-surface-raised) rounded-xl shadow-2xl"
            variants={confirmationVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Icon and Title */}
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full bg-(--color-surface-hover) ${getIconColor()}`}>
                  <Icon icon={getIcon()} size={24} />
                </div>
                <h3 className="text-lg font-semibold text-(--color-text-default)">
                  {title}
                </h3>
              </div>

              {/* Description */}
              <p className="text-(--color-text-muted) leading-relaxed pl-11">
                {description}
              </p>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  variant="soft"
                  color="neutral"
                  onClick={closeConfirmation}
                  disabled={loading}
                  startIcon={<Icon icon={PiX} size={16} />}
                >
                  {cancelText}
                </Button>
                <Button
                  variant="filled"
                  color={getButtonColor()}
                  onClick={handleConfirm}
                  loading={loading}
                  disabled={loading}
                  startIcon={<Icon icon={getIcon()} size={16} />}
                >
                  {confirmText}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
