'use client';

import { useEffect, useState } from 'react';
import { Modal, Tabs, TabList, Tab } from '@/components/ui/surfaces';
import { Button, IconButton } from '@/components/ui/button';
import { Select, ColorPicker } from '@/components/ui/input';
import { Menu, type MenuItem } from '@/components/ui/navigation';
import { Typography } from '@/components/ui/typography';
import { hotToast as toast } from '@/lib/hotToast';
import {
  Icon, PiCopy, PiDownloadSimple, PiCopySimple, PiCaretDown, PiArrowsClockwise,
} from '@/lib/icons';
import { HugeIcon } from './HugeIcon';
import { getStrokeIcon, getDuotoneIcon, type IconSvgElement } from './iconCatalog';
import { buildIconSvgMarkup, svgToPngBlob, downloadBlob, copyTextToClipboard, copyPngBlobToClipboard } from './iconExport';

export type IconStyle = 'stroke' | 'duotone';
/** A Download/Copy menu choice — just the export format.  (An "Outlined"
 *  third option was tried via an offline potrace re-trace of the stroke
 *  set; even at high fidelity too many icons came out visibly misshapen up
 *  close, so it was dropped — Stroke and Duotone are the only two styles.) */
export type ExportFormat = 'svg' | 'png';

const STROKE_WIDTH_OPTIONS = [
  { value: '0.5', label: '0.5' },
  { value: '1',   label: '1' },
  { value: '1.5', label: '1.5' },
  { value: '2',   label: '2' },
  { value: '2.5', label: '2.5' },
  { value: '3',   label: '3' },
];

const SIZE_OPTIONS = ['16', '20', '24', '32', '48', '64', '96', '128'].map((n) => ({ value: n, label: `${n}px` }));

const DEFAULT_STROKE_WIDTH = '1.5';
const DEFAULT_SIZE  = '24';
const DEFAULT_COLOR = '#111827';

export interface IconDetailModalProps {
  open: boolean;
  onClose: () => void;
  iconName: string | null;
  /** Controlled — the parent owns which style is active (it round-trips
   *  this to the URL), so switching Stroke/Duotone inside the modal calls
   *  `onStyleChange` rather than the modal tracking its own copy. */
  style: IconStyle;
  onStyleChange: (style: IconStyle) => void;
}

function getStyleIcon(name: string, style: IconStyle): IconSvgElement | undefined {
  return style === 'stroke' ? getStrokeIcon(name) : getDuotoneIcon(name);
}

/**
 * Detail modal for a single catalog icon — large preview, a stroke-width /
 * size / color customization row (with a reset action), and Download / Copy
 * menu-buttons offering SVG and PNG.  Mirrors the reference Hugeicons
 * picker's controls using only existing design-system primitives
 * (`Button` + `Menu`, no bespoke split-button).
 */
export function IconDetailModal({ open, onClose, iconName, style, onStyleChange }: IconDetailModalProps) {
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_STROKE_WIDTH);
  const [size, setSize]   = useState(DEFAULT_SIZE);
  const [color, setColor] = useState(DEFAULT_COLOR);
  // Labels the Download / Copy buttons with whatever format was picked
  // last, so repeat exports read at a glance — mirrors the reference
  // picker's persistent "SVG STROKED" button label.
  const [downloadFormat, setDownloadFormat] = useState<ExportFormat>('svg');
  const [copyFormat, setCopyFormat] = useState<ExportFormat>('svg');

  // Re-seed the customization controls whenever a NEW icon is opened, so it
  // starts at the default weight/size/color rather than whatever was left
  // over from the previously-viewed icon.  `style` itself is controlled by
  // the parent and doesn't need re-seeding here.
  useEffect(() => {
    if (!open) return;
    setStrokeWidth(DEFAULT_STROKE_WIDTH);
    setSize(DEFAULT_SIZE);
    setColor(DEFAULT_COLOR);
  }, [open, iconName]);

  if (!iconName) return null;

  const data = getStyleIcon(iconName, style);
  const previewSize = Number(size);

  const handleCopyName = async () => {
    try {
      await copyTextToClipboard(iconName);
      toast.success({ title: 'Name copied', description: `"${iconName}" is on your clipboard.` });
    } catch {
      toast.error({ title: 'Could not copy', description: 'Clipboard access was blocked.' });
    }
  };

  const handleReset = () => {
    setStrokeWidth(DEFAULT_STROKE_WIDTH);
    setSize(DEFAULT_SIZE);
    setColor(DEFAULT_COLOR);
  };

  const handleDownload = async (format: ExportFormat) => {
    setDownloadFormat(format);
    if (!data) return;
    const svg = buildIconSvgMarkup(data, { size: previewSize, strokeWidth, color });
    const base = `${iconName}-${style}`;
    try {
      if (format === 'png') {
        const png = await svgToPngBlob(svg, previewSize);
        downloadBlob(png, `${base}.png`);
        toast.success({ title: 'Download started', description: `${base}.png` });
      } else {
        downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${base}.svg`);
        toast.success({ title: 'Download started', description: `${base}.svg` });
      }
    } catch {
      toast.error({ title: 'Download failed', description: 'Could not prepare the file — try again.' });
    }
  };

  const handleCopyIcon = async (format: ExportFormat) => {
    setCopyFormat(format);
    if (!data) return;
    const svg = buildIconSvgMarkup(data, { size: previewSize, strokeWidth, color });
    try {
      if (format === 'png') {
        const png = await svgToPngBlob(svg, previewSize);
        await copyPngBlobToClipboard(png);
      } else {
        await copyTextToClipboard(svg);
      }
      toast.success({ title: 'Copied', description: `${iconName} copied as ${format.toUpperCase()}.` });
    } catch {
      toast.error({ title: 'Could not copy', description: 'Clipboard access was blocked — try downloading instead.' });
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="sm" title="Icon details">
      <div className="flex flex-col items-center gap-5">
        <div
          className="flex h-32 w-32 items-center justify-center rounded-2xl"
          // A fixed light checkerboard rather than a theme-reactive token —
          // `bg-neutral-100` flips to near-black in dark mode, and the
          // icon's own default color is also a near-black hex, so the two
          // would blend into invisibility.  A canvas that stays put
          // regardless of theme (or whatever color is picked) is the only
          // way to always keep the preview legible.
          style={{
            color,
            backgroundImage: 'repeating-conic-gradient(#e2e4e9 0% 25%, #f7f8fa 0% 50%)',
            backgroundSize: '16px 16px',
          }}
        >
          {data ? <HugeIcon icon={data} size={previewSize} strokeWidth={strokeWidth} /> : null}
        </div>

        <div className="flex items-center gap-1.5">
          <Typography variant="h5" as="h3" className="font-mono">{iconName}</Typography>
          <IconButton aria-label="Copy icon name" size="sm" variant="ghost" onClick={handleCopyName}>
            <Icon icon={PiCopy} size={14} />
          </IconButton>
        </div>

        {/* Stroke width / size / color — restyles the live preview above AND
            whatever gets downloaded/copied next.  Reset returns all three to
            their defaults in one click. */}
        <div className="grid w-full grid-cols-[1fr_1fr_1fr_auto] gap-2">
          <Select value={strokeWidth} onChange={setStrokeWidth} options={STROKE_WIDTH_OPTIONS} size="md" />
          <Select value={size} onChange={setSize} options={SIZE_OPTIONS} size="md" />
          <ColorPicker value={color} onChange={setColor} />
          <IconButton aria-label="Reset stroke width, size and color" variant="outlined" onClick={handleReset}>
            <Icon icon={PiArrowsClockwise} size={16} />
          </IconButton>
        </div>

        {/* Style (left) + Download/Copy (right) — switching Stroke/Duotone
            here calls back to the parent page, which is what keeps the
            URL's `?style=` in sync while this modal is open. */}
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <Tabs variant="pills" size="md" defaultValue="stroke" value={style} onValueChange={(v) => onStyleChange(v as IconStyle)}>
            <TabList overflow="none">
              <Tab value="stroke">Stroke</Tab>
              <Tab value="duotone">Duotone</Tab>
            </TabList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Menu
              placement="bottom-end"
              items={[
                { label: 'Download SVG', onClick: () => handleDownload('svg') },
                { label: 'Download PNG', onClick: () => handleDownload('png') },
              ] as MenuItem[]}
              trigger={
                <Button
                  variant="filled"
                  color="primary"
                  startIcon={<Icon icon={PiDownloadSimple} />}
                  endIcon={<Icon icon={PiCaretDown} size={12} />}
                >
                  {downloadFormat === 'png' ? 'Download PNG' : 'Download SVG'}
                </Button>
              }
            />
            <Menu
              placement="bottom-end"
              items={[
                { label: 'Copy SVG', onClick: () => handleCopyIcon('svg') },
                { label: 'Copy PNG', onClick: () => handleCopyIcon('png') },
              ] as MenuItem[]}
              trigger={
                <Button
                  variant="soft"
                  color="primary"
                  startIcon={<Icon icon={PiCopySimple} />}
                  endIcon={<Icon icon={PiCaretDown} size={12} />}
                >
                  {copyFormat === 'png' ? 'Copy PNG' : 'Copy SVG'}
                </Button>
              }
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
