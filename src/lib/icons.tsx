/**
 * Icon registry — thin re-export of Phosphor icons (react-icons/pi) plus an
 * `<Icon>` wrapper that pins an explicit pixel size and lets parent text
 * color cascade in through `currentColor`.
 *
 * All UI components use these `Pi*` names directly — no legacy aliases.  Add
 * any new icons your feature needs to the import block below.
 */
import type { CSSProperties } from 'react';
import type { IconType } from 'react-icons';
import { PiSidebarOpenCustom, PiSidebarCloseCustom } from './customIcons';

export { PiSidebarOpenCustom, PiSidebarCloseCustom };
import {
  // Core actions
  PiPlus,
  PiMinus,
  PiCheck,
  PiX,
  PiTrash,
  PiPencil,
  PiPencilSimple,
  PiFloppyDisk,
  PiCopy,
  PiArrowRight,
  PiArrowLeft,
  PiArrowUp,
  PiArrowDown,
  PiArrowUpRight,
  PiArrowArcLeft,
  PiArrowsLeftRight,
  PiArrowsClockwise,
  PiArrowsOut,
  // Carets / chevrons / dots
  PiCaretDown,
  PiCaretUp,
  PiCaretUpDown,
  PiCaretLeft,
  PiCaretRight,
  PiDotsThree,
  PiDotsThreeVertical,
  // Files
  PiFile,
  PiFilePdf,
  PiFileXls,
  PiFileDoc,
  PiFileMagnifyingGlass,
  PiEmpty,
  // Stars (favourite affordances)
  PiStar,
  PiStarFill,
  // Misc
  PiCopySimple,
  PiBriefcase,
  PiRadioButton,
  PiCheckSquare,
  PiPaperclip,
  // Charts / data
  PiChartBar,
  PiChartLine,
  PiChartLineUp,
  PiChartPieSlice,
  PiSquaresFour,
  PiListChecks,
  PiLayout,
  // Search
  PiMagnifyingGlass,
  // Status / feedback
  PiInfo,
  PiQuestion,
  PiWarning,
  PiWarningCircle,
  PiCheckCircle,
  PiCheckCircleFill,
  PiShieldCheck,
  PiTruck,
  PiHeartbeat,
  PiSpinner,
  PiSparkle,
  PiBug,
  // Time
  PiCalendarBlank,
  PiClock,
  // People / chat
  PiUser,
  PiUserCheck,
  PiUsers,
  PiUsersThree,
  PiChatCircleDots,
  PiPhone,
  PiEnvelope,
  PiPaperPlaneTilt,
  PiBell,
  PiBellSlash,
  // Geo / places
  PiHouse,
  PiBuildings,
  PiBuildingOffice,
  PiMapPin,
  PiGlobe,
  // Commerce
  PiMoney,
  PiReceipt,
  PiCreditCard,
  PiHash,
  PiPrinter,
  // Files / IO
  PiDownloadSimple,
  PiUploadSimple,
  PiShareNetwork,
  PiLink,
  // Security / vision
  PiEye,
  PiEyeSlash,
  PiLock,
  PiLockOpen,
  PiShield,
  // Programs / commerce flavors
  PiConfetti,
  PiStorefront,
  PiShoppingBag,
  PiCarrot,
  PiFileText,
  PiBarcode,
  PiIdentificationBadge,
  PiPlayCircle,
  // Design-system pictograms
  PiTextT,
  PiTable,
  PiToggleRight,
  PiTag,
  PiTextbox,
  PiCursorClick,
  PiBrowsers,
  PiTabs,
  PiSteps,
  PiSquare,
  PiKey,
  // System
  PiGear,
  PiSidebarSimple,
  PiSignOut,
  PiList,
  PiNote,
  PiBookOpen,
  PiGraduationCap,
  PiMedal,
  PiTrophy,
  PiMegaphone,
  PiTarget,
  PiLightning,
  // Theme tools
  PiPalette,
  PiSwatches,
  PiSun,
  PiMoon,
  PiCircleHalf,
  // Quick Help widget (support teams)
  PiHeadset,
  PiCode,
  PiClipboardText,
  // Lead Management
  PiExport,
  PiFunnel,
  PiHandshake,
  PiHandPalm,
} from 'react-icons/pi';

// ── Re-export every Phosphor icon used by the UI library ──────────────────────
export {
  // Core actions
  PiPlus, PiMinus, PiCheck, PiX, PiTrash, PiPencil, PiPencilSimple, PiFloppyDisk, PiCopy,
  PiArrowRight, PiArrowLeft, PiArrowUp, PiArrowDown, PiArrowUpRight, PiArrowArcLeft,
  PiArrowsLeftRight, PiArrowsClockwise, PiArrowsOut,
  // Carets / chevrons / dots
  PiCaretDown, PiCaretUp, PiCaretUpDown, PiCaretLeft, PiCaretRight, PiDotsThree, PiDotsThreeVertical,
  // Files
  PiFile, PiFilePdf, PiFileXls, PiFileDoc, PiFileMagnifyingGlass, PiEmpty,
  PiStar, PiStarFill, PiCopySimple, PiBriefcase,
  PiRadioButton, PiCheckSquare, PiPaperclip,
  // Charts / data
  PiChartBar, PiChartLine, PiChartLineUp, PiChartPieSlice, PiSquaresFour, PiListChecks, PiLayout,
  // Search
  PiMagnifyingGlass,
  // Status / feedback
  PiInfo, PiQuestion, PiWarning, PiWarningCircle, PiCheckCircle, PiCheckCircleFill, PiSpinner, PiSparkle, PiBug,
  PiShieldCheck, PiTruck, PiHeartbeat,
  // Time
  PiCalendarBlank, PiClock,
  // People / chat
  PiUser, PiUserCheck, PiUsers, PiUsersThree, PiChatCircleDots, PiPhone, PiEnvelope, PiPaperPlaneTilt, PiBell, PiBellSlash,
  // Geo / places
  PiHouse, PiBuildings, PiBuildingOffice, PiMapPin, PiGlobe,
  // Commerce
  PiMoney, PiReceipt, PiCreditCard, PiHash, PiPrinter,
  // IO / share
  PiDownloadSimple, PiUploadSimple, PiShareNetwork, PiLink,
  // Security / vision
  PiEye, PiEyeSlash, PiLock, PiLockOpen, PiShield,
  // Programs / commerce flavors
  PiConfetti, PiStorefront, PiShoppingBag, PiCarrot, PiFileText, PiBarcode, PiIdentificationBadge, PiPlayCircle,
  // Design-system pictograms
  PiTextT, PiTable, PiToggleRight, PiTag, PiTextbox, PiCursorClick, PiBrowsers, PiTabs, PiSteps, PiSquare, PiKey,
  // System
  PiGear, PiSidebarSimple, PiSignOut, PiList, PiNote, PiBookOpen, PiGraduationCap, PiMedal, PiTrophy, PiMegaphone,
  PiTarget, PiLightning,
  // Theme tools
  PiPalette, PiSwatches, PiSun, PiMoon, PiCircleHalf,
  // Quick Help widget (support teams)
  PiHeadset, PiCode, PiClipboardText,
  // Lead Management
  PiExport, PiFunnel, PiHandshake, PiHandPalm,
};

// ── Phosphor name registry ────────────────────────────────────────────────────
// Maps each imported icon component back to its `Pi*` name so the dev-mode
// inspector can display "PiPlus" / "PiMagnifyingGlass" / etc. when an icon
// element is selected.  Keep this in sync with the imports above.
const PHOSPHOR_BY_REF = new Map<IconType, string>([
  [PiSidebarOpenCustom,  'PiSidebarOpenCustom'],
  [PiSidebarCloseCustom, 'PiSidebarCloseCustom'],
  [PiPlus, 'PiPlus'],
  [PiMinus, 'PiMinus'],
  [PiCheck, 'PiCheck'],
  [PiX, 'PiX'],
  [PiTrash, 'PiTrash'],
  [PiPencil, 'PiPencil'],
  [PiPencilSimple, 'PiPencilSimple'],
  [PiFloppyDisk, 'PiFloppyDisk'],
  [PiCopy, 'PiCopy'],
  [PiArrowRight, 'PiArrowRight'],
  [PiArrowLeft, 'PiArrowLeft'],
  [PiArrowUp, 'PiArrowUp'],
  [PiArrowDown, 'PiArrowDown'],
  [PiArrowUpRight, 'PiArrowUpRight'],
  [PiArrowArcLeft, 'PiArrowArcLeft'],
  [PiArrowsLeftRight, 'PiArrowsLeftRight'],
  [PiArrowsClockwise, 'PiArrowsClockwise'],
  [PiArrowsOut, 'PiArrowsOut'],
  [PiCaretDown, 'PiCaretDown'],
  [PiCaretUp, 'PiCaretUp'],
  [PiCaretUpDown, 'PiCaretUpDown'],
  [PiCaretLeft, 'PiCaretLeft'],
  [PiCaretRight, 'PiCaretRight'],
  [PiDotsThree, 'PiDotsThree'],
  [PiDotsThreeVertical, 'PiDotsThreeVertical'],
  [PiFile, 'PiFile'],
  [PiFilePdf, 'PiFilePdf'],
  [PiFileXls, 'PiFileXls'],
  [PiFileDoc, 'PiFileDoc'],
  [PiFileMagnifyingGlass, 'PiFileMagnifyingGlass'],
  [PiEmpty, 'PiEmpty'],
  [PiStar, 'PiStar'],
  [PiStarFill, 'PiStarFill'],
  [PiCopySimple, 'PiCopySimple'],
  [PiBriefcase, 'PiBriefcase'],
  [PiRadioButton, 'PiRadioButton'],
  [PiCheckSquare, 'PiCheckSquare'],
  [PiPaperclip, 'PiPaperclip'],
  [PiChartBar, 'PiChartBar'],
  [PiChartLine, 'PiChartLine'],
  [PiChartLineUp, 'PiChartLineUp'],
  [PiChartPieSlice, 'PiChartPieSlice'],
  [PiSquaresFour, 'PiSquaresFour'],
  [PiListChecks, 'PiListChecks'],
  [PiLayout, 'PiLayout'],
  [PiMagnifyingGlass, 'PiMagnifyingGlass'],
  [PiInfo, 'PiInfo'],
  [PiQuestion, 'PiQuestion'],
  [PiWarning, 'PiWarning'],
  [PiWarningCircle, 'PiWarningCircle'],
  [PiCheckCircle, 'PiCheckCircle'],
  [PiCheckCircleFill, 'PiCheckCircleFill'],
  [PiShieldCheck, 'PiShieldCheck'],
  [PiTruck, 'PiTruck'],
  [PiHeartbeat, 'PiHeartbeat'],
  [PiSpinner, 'PiSpinner'],
  [PiSparkle, 'PiSparkle'],
  [PiBug, 'PiBug'],
  [PiCalendarBlank, 'PiCalendarBlank'],
  [PiClock, 'PiClock'],
  [PiUser, 'PiUser'],
  [PiUserCheck, 'PiUserCheck'],
  [PiUsers, 'PiUsers'],
  [PiUsersThree, 'PiUsersThree'],
  [PiChatCircleDots, 'PiChatCircleDots'],
  [PiPhone, 'PiPhone'],
  [PiEnvelope, 'PiEnvelope'],
  [PiPaperPlaneTilt, 'PiPaperPlaneTilt'],
  [PiBell, 'PiBell'],
  [PiBellSlash, 'PiBellSlash'],
  [PiHouse, 'PiHouse'],
  [PiBuildings, 'PiBuildings'],
  [PiBuildingOffice, 'PiBuildingOffice'],
  [PiMapPin, 'PiMapPin'],
  [PiGlobe, 'PiGlobe'],
  [PiMoney, 'PiMoney'],
  [PiReceipt, 'PiReceipt'],
  [PiCreditCard, 'PiCreditCard'],
  [PiDownloadSimple, 'PiDownloadSimple'],
  [PiUploadSimple, 'PiUploadSimple'],
  [PiShareNetwork, 'PiShareNetwork'],
  [PiLink, 'PiLink'],
  [PiEye, 'PiEye'],
  [PiEyeSlash, 'PiEyeSlash'],
  [PiLock, 'PiLock'],
  [PiLockOpen, 'PiLockOpen'],
  [PiShield, 'PiShield'],
  [PiConfetti, 'PiConfetti'],
  [PiStorefront, 'PiStorefront'],
  [PiShoppingBag, 'PiShoppingBag'],
  [PiCarrot, 'PiCarrot'],
  [PiFileText, 'PiFileText'],
  [PiBarcode, 'PiBarcode'],
  [PiIdentificationBadge, 'PiIdentificationBadge'],
  [PiPlayCircle, 'PiPlayCircle'],
  [PiTextT, 'PiTextT'],
  [PiTable, 'PiTable'],
  [PiToggleRight, 'PiToggleRight'],
  [PiTag, 'PiTag'],
  [PiTextbox, 'PiTextbox'],
  [PiCursorClick, 'PiCursorClick'],
  [PiBrowsers, 'PiBrowsers'],
  [PiTabs, 'PiTabs'],
  [PiSteps, 'PiSteps'],
  [PiSquare, 'PiSquare'],
  [PiKey, 'PiKey'],
  [PiGear, 'PiGear'],
  [PiSidebarSimple, 'PiSidebarSimple'],
  [PiSignOut, 'PiSignOut'],
  [PiList, 'PiList'],
  [PiNote, 'PiNote'],
  [PiBookOpen, 'PiBookOpen'],
  [PiGraduationCap, 'PiGraduationCap'],
  [PiMedal, 'PiMedal'],
  [PiTrophy, 'PiTrophy'],
  [PiMegaphone, 'PiMegaphone'],
  [PiTarget, 'PiTarget'],
  [PiLightning, 'PiLightning'],
  [PiPalette, 'PiPalette'],
  [PiSwatches, 'PiSwatches'],
  [PiSun, 'PiSun'],
  [PiMoon, 'PiMoon'],
  [PiCircleHalf, 'PiCircleHalf'],
  [PiHeadset, 'PiHeadset'],
  [PiCode, 'PiCode'],
  [PiClipboardText, 'PiClipboardText'],
  [PiExport, 'PiExport'],
  [PiFunnel, 'PiFunnel'],
  [PiHandshake, 'PiHandshake'],
  [PiHandPalm, 'PiHandPalm'],
]);

export function getIconName(cmp: IconType): string | undefined {
  return PHOSPHOR_BY_REF.get(cmp);
}

// ── <Icon /> wrapper ───────────────────────────────────────────────────────────
export type IconComponent = IconType;

export interface IconProps {
  icon: IconComponent;
  size?: number | string;
  color?: string;
  /** Kept for API compatibility — Phosphor ignores this. */
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  'aria-hidden'?: boolean;
  title?: string;
}

/**
 * Renders a Phosphor icon at an explicit pixel size. Passes `size` (instead of
 * width/height) because react-icons always overrides width/height from its
 * internal `size` prop (default `"1em"`).
 *
 * Intentionally does NOT pass `color` unless explicitly provided — setting it
 * would render `style="color: currentColor"` inline on the SVG, which then
 * resolves against the PARENT and beats any `text-*` Tailwind class on the
 * same element. Leaving it unset lets the SVG inherit `currentColor` from
 * its own `className`.
 */
export function Icon({
  icon: Cmp,
  size = 18,
  color,
  className,
  style,
  title,
  ...rest
}: IconProps) {
  const phosphorName = PHOSPHOR_BY_REF.get(Cmp);
  return (
    <Cmp
      size={size}
      {...(color !== undefined ? { color } : {})}
      className={className}
      style={style}
      title={title}
      aria-hidden={rest['aria-hidden'] ?? true}
      data-component="Icon"
      data-icon={phosphorName}
    />
  );
}
