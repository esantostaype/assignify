import { Icon, PiMagnifyingGlass, PiIdentificationBadge } from '@/lib/icons'

interface Props {
  isActive?: boolean;
}

export const SpinnerSearching = ({ isActive }: Props) => {
  return (
    <div
      className={`absolute top-0 left-0 h-dvh w-full flex items-center justify-center transition-all ${
        isActive ? "opacity-100 visible" : "opacity-0 invisible"
      } z-[99999]`}
    >
      <div className="z-20 relative flex flex-col items-center gap-2">
        <div>
          <div className="relative z-20">
            <div className="orbit-container">
              <div className="orbiting-icon">
                <Icon icon={PiMagnifyingGlass} size={32} strokeWidth={1.5} />
              </div>
            </div>
          </div>
          <div className='absolute top-0 z-10'>
            <Icon icon={PiIdentificationBadge} size={48} strokeWidth={1.5} color="var(--color-text-muted)" />
          </div>
        </div>
        <div>Matching designer...</div>
      </div>
      <span className="absolute z-10 h-dvh w-full bg-(--color-surface-app) opacity-80 top-0 left-0"></span>
    </div>
  );
};
