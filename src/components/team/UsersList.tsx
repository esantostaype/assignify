import React, { useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { FileSearchIcon, CheckmarkSquare01Icon, ArrowReloadHorizontalIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/shadcn/button";
import { UserCard } from "./UserCard";
import { SyncedMemberCard, type MemberUser } from "./SyncedMemberCard";
import { MemberCardSkeleton } from "./MemberCardSkeleton";
import { UserCardSkeleton } from "./UserCardSkeleton";
import type { UserWorkload } from "@/hooks/queries/useWorkload";

interface UsersListProps {
  users: MemberUser[];
  selectedUsers: Set<string>;
  onUserSelect: (userId: string, selected: boolean) => void;
  onUserEdit: (userId: string) => void;
  loading?: boolean;
  /** Carga de trabajo de los diseñadores sincronizados (cruzada por id). */
  workload?: UserWorkload[];
  workloadLoading?: boolean;
  // Acciones de sync: viven en la cabecera de la sección "Available to sync".
  selectedCount: number;
  availableCount: number;
  allAvailableSelected: boolean;
  onSelectAll: () => void;
  onSync: () => void;
  syncing?: boolean;
}

export const UsersList: React.FC<UsersListProps> = ({
  users,
  selectedUsers,
  onUserSelect,
  onUserEdit,
  loading = false,
  workload = [],
  workloadLoading = false,
  selectedCount,
  availableCount,
  allAvailableSelected,
  onSelectAll,
  onSync,
  syncing = false,
}) => {
  // Index de carga por id de ClickUp (workload.id === user.clickupId).
  const workloadById = useMemo(() => {
    const map = new Map<string, UserWorkload>();
    for (const w of workload) map.set(w.id, w);
    return map;
  }, [workload]);

  const syncedUsers = useMemo(() => users.filter((u) => u.existsInLocal), [users]);
  const availableUsers = useMemo(() => users.filter((u) => !u.existsInLocal), [users]);

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Synced</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            <MemberCardSkeleton />
            <MemberCardSkeleton />
            <MemberCardSkeleton />
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-foreground">Available to sync</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            <UserCardSkeleton />
            <UserCardSkeleton />
            <UserCardSkeleton />
            <UserCardSkeleton />
          </div>
        </section>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-12">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <HugeiconsIcon icon={FileSearchIcon} size={24} />
          </div>
          <h3 className="mb-1 text-lg font-semibold text-foreground">No users found</h3>
          <p className="text-sm text-muted-foreground">Check ClickUp API configuration or try refreshing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Diseñadores sincronizados (tarjeta completa con carga) ── */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Synced
          <span className="ml-2 text-sm font-normal text-muted-foreground">{syncedUsers.length}</span>
        </h2>
        {syncedUsers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No synced members yet.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-3">
            {syncedUsers.map((user) => (
              <SyncedMemberCard
                key={user.clickupId}
                user={user}
                workload={workloadById.get(user.clickupId)}
                workloadLoading={workloadLoading}
                onEdit={() => onUserEdit(user.clickupId)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Disponibles para sincronizar (tarjeta compacta) ── */}
      {availableUsers.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              Available to sync
              <span className="ml-2 text-sm font-normal text-muted-foreground">{availableUsers.length}</span>
            </h2>
            <div className="flex gap-2">
              <Button variant="soft" size="sm" onClick={onSelectAll} disabled={availableCount === 0}>
                <HugeiconsIcon icon={CheckmarkSquare01Icon} size={16} />
                {allAvailableSelected ? "Deselect" : "Select"} Available
              </Button>
              <Button size="sm" onClick={onSync} disabled={selectedCount === 0 || syncing}>
                <HugeiconsIcon icon={ArrowReloadHorizontalIcon} size={16} className={cn(syncing && "animate-spin")} />
                Sync ({selectedCount})
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {availableUsers.map((user) => (
              <UserCard
                key={user.clickupId}
                user={user}
                isSelected={selectedUsers.has(user.clickupId)}
                onSelect={(selected) => onUserSelect(user.clickupId, selected)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
