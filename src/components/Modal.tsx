// src/components/Modal.tsx
// Adaptador: conecta el modalStore global con el <Modal> de /components/ui.
// (Antes era una implementación propia con framer-motion; ahora usa la librería.)
'use client'

import React from 'react'
import { Modal, type ModalSize } from '@/components/ui'
import { useModalStore } from '@/stores/modalStore'

const SIZE_MAP: Record<'sm' | 'md' | 'lg', ModalSize> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
}

export const GlobalModal: React.FC = () => {
  const { isOpen, title, content, size, closeModal } = useModalStore()

  return (
    <Modal open={isOpen} onClose={closeModal} title={title} size={SIZE_MAP[size] ?? 'lg'}>
      {content}
    </Modal>
  )
}
