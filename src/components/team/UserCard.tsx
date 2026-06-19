import React from "react";
import { Icon, PiUserCheck } from "@/lib/icons";
import { Avatar, Checkbox } from "@/components/ui";
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
// sincronizar): foto a la izquierda, nombre + estado "Available" a la derecha,
// centrados verticalmente. Mantiene el checkbox de selección para el Sync.
export const UserCard: React.FC<UserCardProps> = ({
  user,
  isSelected = false,
  onSelect,
}) => {
  return (
    <label
      className={`
      flex items-center gap-3 p-3 rounded-lg relative cursor-pointer
      transition-all border-2
      ${
        isSelected
          ? "bg-primary-500/10 border-primary-500/30"
          : "bg-primary-500/10 border-transparent hover:bg-primary-500/20"
      }
    `}
    >
      {/* Selection checkbox */}
      {onSelect && (
        <Checkbox
          checked={isSelected}
          onChange={(event) => onSelect(event.target.checked)}
        />
      )}

      <Avatar
        src={user.profilePicture}
        className="!h-11 !w-11"
        style={{ backgroundColor: avatarColor(user.color, user.clickupId), color: "#fff" }}
      >
        {user.initials}
      </Avatar>

      {/* Nombre + estado */}
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold text-(--color-text-strong)">
          {user.name}
        </h3>
        <div className="flex items-center gap-1 text-xs uppercase text-green-500">
          <Icon icon={PiUserCheck} size={14} />
          Available
        </div>
      </div>
    </label>
  );
};
