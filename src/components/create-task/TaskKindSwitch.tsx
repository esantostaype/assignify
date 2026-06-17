import React from 'react'
import { Icon, PiLayout, PiPalette } from '@/lib/icons'

interface TaskKindSwitchProps {
  selectedKind: 'UX/UI' | 'Graphic'
  onKindChange: (kind: 'UX/UI' | 'Graphic') => void
}

export const TaskKindSwitch: React.FC<TaskKindSwitchProps> = ({
  selectedKind,
  onKindChange
}) => {
  const baseStyle = `cursor-pointer flex items-center justify-center gap-2 py-[0.8rem] px-4 text-sm font-semibold transition-colors w-full`;

  const activeStyle = `bg-primary-500/20 text-white`;
  const inactiveStyle = `bg-transparent border-(--color-border-default) text-(--color-text-subtle) hover:text-white`;

  return (
    <div className="flex w-full rounded-md overflow-hidden bg-primary-500/10">
      <button
        type="button"
        className={`${baseStyle} ${selectedKind === 'UX/UI' ? activeStyle : inactiveStyle}`}
        onClick={() => onKindChange('UX/UI')}
      >
        <Icon icon={PiLayout} size={24} strokeWidth={1.5} />
        UX/UI
      </button>
      <button
        type="button"
        className={`${baseStyle} ${selectedKind === 'Graphic' ? activeStyle : inactiveStyle}`}
        onClick={() => onKindChange('Graphic')}
      >
        <Icon icon={PiPalette} size={24} strokeWidth={1.5} />
        Graphic
      </button>
    </div>
  )
}
