'use client';

import { useEffect, useState } from 'react';
import { Modal, Tabs, TabList, Tab } from '@/components/ui/surfaces';
import { Button, IconButton } from '@/components/ui/button';
import { Select, ColorPicker } from '@/components/ui/input';
import { Menu, type MenuItem } from '@/components/ui/navigation';
import { Typography } from '@/components/ui/typography';
import { hotToast as toast } from '@/lib/hotToast';
import { useUiTheme } from '@/providers/UiThemeProvider';
import {
  Icon, PiCopy, PiDownloadSimple, PiCopySimple, PiCaretDown, PiArrowsClockwise,
} from '@/lib/icons';
import { HugeIcon } from './HugeIcon';
import { getStrokeIcon, getDuotoneIcon, type IconSvgElement } from './iconCatalog';
import { buildIconSvgMarkup, svgToPngBlob, downloadBlob, copyTextToClipboard, copyPngBlobToClipboard } from './iconExport';

export type IconStyle = 'stroke' | 'duotone';
/** A Download/Copy menu choice — just the export format. */
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

const DEFAULT_STROKE_WIDTH = '1';
const DEFAULT_SIZE  = '48';
// El color por defecto sigue el tema (un hex oscuro fijo desaparecería sobre la
// superficie dark del modal). Coincide con `--color-text-strong` en cada tema.
const DEFAULT_COLOR_LIGHT = '#111827';
const DEFAULT_COLOR_DARK  = '#F3F4F6';

// ── localStorage: recordamos color, tamaño, grosor y el formato de Download/Copy
// entre aperturas del modal y entre recargas. SSR-safe (guard `typeof window`).
const COLOR_KEY   = 'hugeicons-icon-color';
const SIZE_KEY    = 'hugeicons-icon-size';
const STROKE_KEY  = 'hugeicons-icon-stroke';
const DOWNLOAD_FORMAT_KEY = 'hugeicons-download-format';
const COPY_FORMAT_KEY     = 'hugeicons-copy-format';
const SAVED_COLORS_KEY    = 'hugeicons-saved-colors';

function lsGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(key, value); } catch { /* storage no disponible */ }
}
function lsRemove(key: string): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(key); } catch { /* storage no disponible */ }
}

const isSize   = (v: string | null): v is string => !!v && SIZE_OPTIONS.some((o) => o.value === v);
const isStroke = (v: string | null): v is string => !!v && STROKE_WIDTH_OPTIONS.some((o) => o.value === v);
const asFormat = (v: string | null): ExportFormat => (v === 'png' ? 'png' : 'svg');

export interface IconDetailModalProps {
  open: boolean;
  onClose: () => void;
  iconName: string | null;
  style: IconStyle;
  onStyleChange: (style: IconStyle) => void;
}

function getStyleIcon(name: string, style: IconStyle): IconSvgElement | undefined {
  return style === 'stroke' ? getStrokeIcon(name) : getDuotoneIcon(name);
}

/**
 * Detail modal for a single catalog icon — preview + customization row
 * (stroke width / size / color, todo recordado en localStorage) y botones
 * Download / Copy tipo "split": el cuerpo ejecuta el formato recordado y la
 * flechita abre el menú para elegir/cambiar SVG o PNG (también recordado).
 */
export function IconDetailModal({ open, onClose, iconName, style, onStyleChange }: IconDetailModalProps) {
  const { theme } = useUiTheme();
  const defaultColor = theme === 'dark' ? DEFAULT_COLOR_DARK : DEFAULT_COLOR_LIGHT;

  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_STROKE_WIDTH);
  const [size, setSize]   = useState(DEFAULT_SIZE);
  const [color, setColor] = useState(defaultColor);
  // Formato recordado de Download / Copy (última elección del usuario).
  const [downloadFormat, setDownloadFormat] = useState<ExportFormat>(() => asFormat(lsGet(DOWNLOAD_FORMAT_KEY)));
  const [copyFormat, setCopyFormat] = useState<ExportFormat>(() => asFormat(lsGet(COPY_FORMAT_KEY)));

  // Al abrir un icono, sembramos TODO desde lo recordado (color/tamaño/grosor) o
  // los defaults si no hay nada guardado. Así el tamaño y grosor de la última vez
  // se conservan (antes se reseteaban en cada apertura).
  useEffect(() => {
    if (!open) return;
    const storedStroke = lsGet(STROKE_KEY);
    const storedSize = lsGet(SIZE_KEY);
    setStrokeWidth(isStroke(storedStroke) ? storedStroke : DEFAULT_STROKE_WIDTH);
    setSize(isSize(storedSize) ? storedSize : DEFAULT_SIZE);
    setColor(lsGet(COLOR_KEY) ?? defaultColor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Cada cambio del row de customización se RECUERDA para la próxima vez.
  const handleColorChange = (next: string) => { setColor(next); lsSet(COLOR_KEY, next); };
  const handleStrokeChange = (next: string) => { setStrokeWidth(next); lsSet(STROKE_KEY, next); };
  const handleSizeChange = (next: string) => { setSize(next); lsSet(SIZE_KEY, next); };

  const handleReset = () => {
    setStrokeWidth(DEFAULT_STROKE_WIDTH);
    setSize(DEFAULT_SIZE);
    setColor(defaultColor);
    lsRemove(COLOR_KEY);
    lsRemove(SIZE_KEY);
    lsRemove(STROKE_KEY);
  };

  const handleDownload = async (format: ExportFormat) => {
    setDownloadFormat(format);
    lsSet(DOWNLOAD_FORMAT_KEY, format);
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
    lsSet(COPY_FORMAT_KEY, format);
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
          className="flex h-32 w-32 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-(--color-surface-card)"
          style={{ color }}
        >
          {data ? <HugeIcon icon={data} size={previewSize} strokeWidth={strokeWidth} /> : null}
        </div>

        <div className="flex items-center gap-1.5">
          <Typography variant="h5" as="h3" className="font-mono">{iconName}</Typography>
          <IconButton aria-label="Copy icon name" size="sm" variant="ghost" onClick={handleCopyName}>
            <Icon icon={PiCopy} size={14} />
          </IconButton>
        </div>

        {/* Stroke width / size / color — recordados en localStorage. Reset vuelve
            los tres a su default y olvida lo guardado. */}
        <div className="grid w-full grid-cols-[1fr_1fr_1fr_auto] gap-2">
          <Select value={strokeWidth} onChange={handleStrokeChange} options={STROKE_WIDTH_OPTIONS} size="md" />
          <Select value={size} onChange={handleSizeChange} options={SIZE_OPTIONS} size="md" />
          <ColorPicker value={color} onChange={handleColorChange} storageKey={SAVED_COLORS_KEY} />
          <IconButton aria-label="Reset stroke width, size and color" variant="outlined" onClick={handleReset}>
            <Icon icon={PiArrowsClockwise} size={16} />
          </IconButton>
        </div>

        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <Tabs variant="pills" size="md" defaultValue="stroke" value={style} onValueChange={(v) => onStyleChange(v as IconStyle)}>
            <TabList overflow="none">
              <Tab value="stroke">Stroke</Tab>
              <Tab value="duotone">Duotone</Tab>
            </TabList>
          </Tabs>

          <div className="flex items-center gap-2">
            {/* Split-button Download: el CUERPO descarga el formato recordado; la
                FLECHITA (solo ella) abre el menú para elegir/cambiar SVG/PNG. */}
            <div className="inline-flex overflow-hidden rounded-md">
              <Button
                variant="filled"
                color="primary"
                style={{ borderRadius: 0 }}
                startIcon={<Icon icon={PiDownloadSimple} />}
                onClick={() => handleDownload(downloadFormat)}
              >
                {downloadFormat === 'png' ? 'Download PNG' : 'Download SVG'}
              </Button>
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
                    className="border-l border-primary-700/40"
                    style={{ borderRadius: 0, paddingLeft: 8, paddingRight: 8 }}
                    aria-label="Choose download format"
                  >
                    <Icon icon={PiCaretDown} size={12} />
                  </Button>
                }
              />
            </div>

            {/* Split-button Copy: idéntica lógica. */}
            <div className="inline-flex overflow-hidden rounded-md">
              <Button
                variant="soft"
                color="primary"
                style={{ borderRadius: 0 }}
                startIcon={<Icon icon={PiCopySimple} />}
                onClick={() => handleCopyIcon(copyFormat)}
              >
                {copyFormat === 'png' ? 'Copy PNG' : 'Copy SVG'}
              </Button>
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
                    className="border-l border-primary-300/50"
                    style={{ borderRadius: 0, paddingLeft: 8, paddingRight: 8 }}
                    aria-label="Choose copy format"
                  >
                    <Icon icon={PiCaretDown} size={12} />
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
