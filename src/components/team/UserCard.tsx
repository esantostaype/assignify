import React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { UserCheck01Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/shadcn/avatar";
import { Checkbox } from "@/components/shadcn/checkbox";
import { avatarColor } from "@/lib/avatarColor";

interface UserCardProps {
  user: {
    clickupId: string;
    name: string;
    email: string;
    profilePicture: string;
    initials: string;
    color: string;
    existsInLocal: boolean;
    canSync: boolean;
    lastActive?: string;
  };
  isSelected?: boolean;
  onSelect?: (selected: boolean) => void;
}

// Tarjeta COMPACTA horizontal para diseñadores NO sincronizados (disponibles para
// sincronizar): foto + nombre + estado "Available". Toda la tarjeta es clickeable
// para seleccionar (el checkbox es indicador visual). Selección = ring del acento.
export const UserCard: React.FC<UserCardProps> = ({
  user,
  isSelected = false,
  onSelect,
}) => {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(!isSelected)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(!isSelected);
        }
      }}
      className={cn(
        "relative flex cursor-pointer items-center gap-3 rounded-lg bg-card p-3 ring-1 transition-colors",
        isSelected ? "ring-primary/40" : "ring-transparent hover:bg-accent"
      )}
    >
      {onSelect && <Checkbox checked={isSelected} tabIndex={-1} className="pointer-events-none" />}

      <Avatar className="size-11">
        {user.profilePicture && <AvatarImage src={user.profilePicture} alt={user.name} />}
        <AvatarFallback className="text-white" style={{ backgroundColor: avatarColor(user.color, user.clickupId) }}>
          {user.initials}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold text-foreground">{user.name}</h3>
        <div className="flex items-center gap-1 text-xs uppercase text-success-500">
          <HugeiconsIcon icon={UserCheck01Icon} size={14} />
          Available
        </div>
      </div>
    </div>
  );
};
