'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SearchInput } from '@/components/ui/input';
import { Card, Tabs, TabList, Tab } from '@/components/ui/surfaces';
import { Pagination } from '@/components/ui/navigation';
import { EmptyState } from '@/components/ui/data';
import { Typography } from '@/components/ui/typography';
import { PiMagnifyingGlass } from '@/lib/icons';
import { Skeleton, Chip } from '@/components/ui';
import { HugeIcon } from './HugeIcon';
import { ICON_NAMES, getStrokeIcon, getDuotoneIcon, loadIconData } from './iconCatalog';
import { IconDetailModal, type IconStyle } from './IconDetailModal';
import { filterIconNames, getSearchSuggestions } from './searchSynonyms';

const PAGE_SIZE = 100;
const SKELETON_CARD_COUNT = 100;

/** Page-level tab filter — "All" has no data of its own (every icon is
 *  always rendered as either Stroke or Duotone), so it just means "no
 *  style filter chosen yet" and renders the grid as Stroke.  Kept distinct
 *  from `IconStyle` (the modal's concrete stroke/duotone choice) because
 *  "all" isn't a real render style. */
type PageStyleFilter = 'all' | IconStyle;

function isPageStyleFilter(v: string | null): v is PageStyleFilter {
  return v === 'all' || v === 'stroke' || v === 'duotone';
}

/** Case-insensitive lookup so a URL like `?icon=earthicon` still resolves
 *  to the catalog's real `EarthIcon` casing. */
function findIconName(param: string | null): string | null {
  if (!param) return null;
  const lower = param.toLowerCase();
  return ICON_NAMES.find((n) => n.toLowerCase() === lower) ?? null;
}

function IconCardSkeleton() {
  return (
    <Card
      padding="sm"
      className="flex aspect-square flex-col items-center justify-between gap-2"
      aria-hidden
    >
      <div className="flex flex-1 w-full items-center justify-center">
        <Skeleton variant="circle" width={30} height={30} />
      </div>
      <Skeleton variant="text" width="72%" height={10} />
    </Card>
  );
}

function IconGridSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3">
      {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
        <IconCardSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * Hugeicons — browsable catalog of every icon vendored in
 * `@/lib/hugeicons/stroke` + `@/lib/hugeicons/duotone`, split into
 * All / Stroke / Duotone tabs, searchable, and paginated 100 at a time.
 * Clicking a card opens `IconDetailModal` to download or copy it as SVG or
 * PNG.  Tab, search query, and the open icon all round-trip through the
 * URL (`?style=`, `&search=`, `&icon=`) so a producer can share or
 * bookmark a link straight to a specific icon.
 */
export function HugeiconsBrowser() {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const searchParams = useSearchParams();

  // Seed every piece of state from the URL exactly once on mount — later
  // changes flow the OTHER way (state → URL) via the effect below, so this
  // intentionally never re-reads `searchParams` after first render.
  const [tab, setTab] = useState<PageStyleFilter>(() => {
    const s = searchParams?.get('style') ?? null;
    return isPageStyleFilter(s) ? s : 'all';
  });
  const [query, setQuery] = useState(() => searchParams?.get('search') ?? '');
  const [page, setPage]   = useState(1);
  const [selected, setSelected] = useState<string | null>(() => findIconName(searchParams?.get('icon') ?? null));
  // Which style the detail modal opens into.  On the Stroke/Duotone tabs
  // this always matches the tab; on "All" each icon shows both renditions
  // side by side, so it tracks whichever half was actually clicked.
  const [openedStyle, setOpenedStyle] = useState<IconStyle>(() => (tab === 'duotone' ? 'duotone' : 'stroke'));

  const openIcon = (name: string, style: IconStyle) => {
    setSelected(name);
    setOpenedStyle(style);
  };

  // Los datos de los iconos (~11MB) ya NO van en el bundle: se descargan en runtime desde
  // /public la primera vez que se abre la galería (así el build no los compila).
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let alive = true;
    loadIconData()
      .then(() => { if (alive) setReady(true); })
      .catch(() => { if (alive) setLoadError(true); });
    return () => { alive = false; };
  }, []);

  // Keep the URL in sync with the current filter/search/open-icon state —
  // rebuilt from scratch each time so the params never fight each other.
  // `replace` (not `push`) so browsing icons doesn't spam history.
  useEffect(() => {
    const params = new URLSearchParams();
    // While the modal is open, the style it's actually showing (which the
    // user can flip independently of the page tab) wins; otherwise it
    // follows the page tab, and "All" means no style param at all.
    const effectiveStyle = selected ? openedStyle : (tab !== 'all' ? tab : null);
    if (effectiveStyle) params.set('style', effectiveStyle);
    if (query.trim()) params.set('search', query.trim());
    if (selected) params.set('icon', selected.toLowerCase());
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [tab, query, selected, openedStyle, pathname, router]);

  // Matches on the literal query AND every term in whatever synonym
  // group(s) it belongs to — "globe" also surfaces "EarthIcon" / "WorldIcon",
  // "deal" surfaces "Agreement01Icon", etc. — word-aware so adjacent words
  // in a name can't accidentally spell an unrelated term.  See
  // searchSynonyms.ts.
  const filtered = useMemo(() => filterIconNames(ICON_NAMES, query), [query]);
  const suggestions = useMemo(() => getSearchSuggestions(query), [query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage    = Math.min(page, totalPages);
  const pageItems   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const getIcon = tab === 'duotone' ? getDuotoneIcon : getStrokeIcon;

  const handleTabChange = (v: string) => { setTab(v as PageStyleFilter); setPage(1); };
  const handleSearch    = (v: string) => { setQuery(v); setPage(1); };
  const handleSuggestion = (suggestion: string) => { setQuery(suggestion); setPage(1); };

  return (
    <>
      <div className="p-4 md:p-6">
        <div className="mx-auto w-full max-w-7xl">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs variant="pills" size="md" defaultValue="all" value={tab} onValueChange={handleTabChange}>
              <TabList overflow="none">
                <Tab value="all">All</Tab>
                <Tab value="stroke">Stroke</Tab>
                <Tab value="duotone">Duotone</Tab>
              </TabList>
            </Tabs>
            <div className="w-full sm:w-72">
              <SearchInput
                placeholder="Search icons…"
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Sugerencias de búsqueda (sinónimos ES/EN): fila completa alineada a la
              izquierda; cada término es un Chip clickeable que rellena el buscador. */}
          {suggestions.length > 0 && (
            <div className="mb-4 flex w-full flex-wrap gap-1.5">
              {suggestions.map((suggestion) => (
                <Chip
                  key={suggestion}
                  size="sm"
                  color="primary"
                  variant="soft"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSuggestion(suggestion)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSuggestion(suggestion);
                    }
                  }}
                  className="cursor-pointer transition-colors hover:bg-primary-200"
                >
                  {suggestion}
                </Chip>
              ))}
            </div>
          )}

          <div className="min-h-[calc(100vh-10rem)]">
            {!ready ? (
              loadError ? (
                <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center text-center text-sm text-(--color-text-muted)">
                  Couldn&apos;t load the icon library. Please reload the page.
                </div>
              ) : (
                <IconGridSkeleton />
              )
            ) : pageItems.length === 0 ? (
              <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
                <EmptyState
                  icon={PiMagnifyingGlass}
                  title="No icons found"
                  description={`No icon names match "${query}".`}
                />
              </div>
            ) : tab === 'all' ? (
          // "All" lists BOTH renditions of every icon as their own
          // independent cards — a Stroke card immediately followed by that
          // same icon's Duotone card — rather than merging the two into a
          // single card.
          <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3">
            {pageItems.flatMap((name) => {
              const strokeData  = getStrokeIcon(name);
              const duotoneData = getDuotoneIcon(name);
              return [
                strokeData && (
                  <Card
                    key={`${name}-stroke`}
                    padding="sm"
                    onClick={() => openIcon(name, 'stroke')}
                    className="flex aspect-square cursor-pointer flex-col items-center justify-between gap-2 transition-colors hover:bg-(--color-surface-muted)"
                  >
                    <div className="flex flex-1 w-full items-center justify-center">
                      <HugeIcon icon={strokeData} size={28} className="text-(--color-text-default)" />
                    </div>
                    <Typography variant="code" as="span" className="w-full truncate text-center text-[10px]">
                      {name}
                    </Typography>
                  </Card>
                ),
                duotoneData && (
                  <Card
                    key={`${name}-duotone`}
                    padding="sm"
                    onClick={() => openIcon(name, 'duotone')}
                    className="flex aspect-square cursor-pointer flex-col items-center justify-between gap-2 transition-colors hover:bg-(--color-surface-muted)"
                  >
                    <div className="flex flex-1 w-full items-center justify-center">
                      <HugeIcon icon={duotoneData} size={28} className="text-(--color-text-default)" />
                    </div>
                    <Typography variant="code" as="span" className="w-full truncate text-center text-[10px]">
                      {name}
                    </Typography>
                  </Card>
                ),
              ];
            })}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-3">
            {pageItems.map((name) => {
              const data = getIcon(name);
              if (!data) return null;
              return (
                <Card
                  key={name}
                  padding="sm"
                  onClick={() => openIcon(name, tab === 'duotone' ? 'duotone' : 'stroke')}
                  className="flex aspect-square cursor-pointer flex-col items-center justify-between gap-2 transition-colors hover:bg-(--color-surface-muted)"
                >
                  <div className="flex flex-1 w-full items-center justify-center">
                    <HugeIcon icon={data} size={28} className="text-(--color-text-default)" />
                  </div>
                  <Typography variant="code" as="span" className="w-full truncate text-center text-[10px]">
                    {name}
                  </Typography>
                </Card>
              );
            })}
          </div>
        )}
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
          </div>
        )}
        </div>
      </div>

      <IconDetailModal
        open={selected !== null}
        onClose={() => setSelected(null)}
        iconName={selected}
        style={openedStyle}
        onStyleChange={setOpenedStyle}
      />
    </>
  );
}
