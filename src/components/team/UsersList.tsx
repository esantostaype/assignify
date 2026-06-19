import React, { useMemo } from "react";
import { UserCard } from "./UserCard";
import { SyncedMemberCard, type MemberUser } from "./SyncedMemberCard";
import { Icon, PiFileMagnifyingGlass } from "@/lib/icons";
import { MemberCardSkeleton } from "./MemberCardSkeleton";
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
}

export const UsersList: React.FC<UsersListProps> = ({
  users,
  selectedUsers,
  onUserSelect,
  onUserEdit,
  loading = false,
  workload = [],
  workloadLoading = false,
}) => {
  // Index de carga por id de ClickUp (workload.id === user.clickupId).
  const workloadById = useMemo(() => {
    const map = new Map<string, UserWorkload>();
    for (const w of workload) map.set(w.id, w);
    return map;
  }, [workload]);

  const syncedUsers = useMemo(
    () => users.filter((u) => u.existsInLocal),
    [users]
  );
  const availableUsers = useMemo(
    () => users.filter((u) => !u.existsInLocal),
    [users]
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-8">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-(--color-text-strong)">
            Synced
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <MemberCardSkeleton />
            <MemberCardSkeleton />
            <MemberCardSkeleton />
          </div>
        </section>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="h-full flex items-center justify-center py-12">
        <div className="text-center">
          <Icon
            icon={PiFileMagnifyingGlass}
            size={48}
            className="mx-auto mb-4 text-(--color-text-subtle)"
          />
          <h3 className="text-2xl font-medium mb-2">No users found</h3>
          <p className="text-(--color-text-subtle)">
            Check ClickUp API configuration or try refreshing
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Diseñadores sincronizados (tarjeta completa con carga) ── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-(--color-text-strong)">
          Synced
          <span className="ml-2 text-sm font-normal text-(--color-text-muted)">
            {syncedUsers.length}
          </span>
        </h2>
        {syncedUsers.length === 0 ? (
          <p className="text-sm text-(--color-text-muted)">
            No synced members yet.
          </p>
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
          <h2 className="mb-4 text-lg font-semibold text-(--color-text-strong)">
            Available to sync
            <span className="ml-2 text-sm font-normal text-(--color-text-muted)">
              {availableUsers.length}
            </span>
          </h2>
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
