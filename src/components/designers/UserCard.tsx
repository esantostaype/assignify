import React from "react";
import {
  Icon,
  PiEnvelope,
  PiIdentificationBadge,
  PiPencilSimple,
  PiArrowsClockwise,
  PiUserCheck,
} from "@/lib/icons";
import { Avatar, Checkbox, IconButton } from "@/components/ui";

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
  onEdit?: () => void;
  showSelection?: boolean;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  isSelected = false,
  onSelect,
  onEdit,
  showSelection = true,
}) => {
  return (
    <div
      className={`
      p-6 rounded-lg flex flex-col items-center relative text-center gap-4
      transition-all border-2
      ${
        user.existsInLocal
          ? "bg-(--color-surface-hover) border-transparent"
          : isSelected
          ? "bg-primary-500/10 border-primary-500/30"
          : "bg-primary-500/10 border-transparent hover:bg-primary-500/20"
      }
    `}
    >
      {/* Selection checkbox */}
      {showSelection && !user.existsInLocal && onSelect && (
        <div className="absolute top-4 left-4 z-20">
          <Checkbox
            checked={isSelected}
            onChange={(event) => onSelect(event.target.checked)}
          />
        </div>
      )}

      {/* Edit button for existing users */}
      {user.existsInLocal && onEdit && (
        <div className="absolute top-4 right-4 z-20">
          <IconButton
            aria-label="Edit user"
            size="sm"
            variant="soft"
            color="primary"
            onClick={onEdit}
          >
            <Icon icon={PiPencilSimple} size={16} />
          </IconButton>
        </div>
      )}
      <Avatar
        src={user.profilePicture}
        className="!h-20 !w-20 text-2xl"
        style={user.color ? { backgroundColor: user.color } : undefined}
      >
        {user.initials}
      </Avatar>

      {/* User Info */}
      <div className="flex-1">
        <div>
          <h3 className="font-semibold text-lg">{user.name}</h3>
          {user.existsInLocal ? (
            <div className="flex items-center gap-1 justify-center text-xs uppercase text-yellow-400">
              <Icon icon={PiArrowsClockwise} size={16} />
              Synced
            </div>
          ) : (
            <div className="flex items-center gap-1 justify-center text-xs uppercase text-green-400">
              <Icon icon={PiUserCheck} size={16} />
              Available
            </div>
          )}
        </div>
      </div>

      {/* User Details */}
      <div className="text-sm flex flex-col gap-1">
        <div className="flex items-center gap-1 justify-center">
          <Icon icon={PiEnvelope} size={16} />
          {user.email}
        </div>
        <div className="flex items-center gap-1 justify-center">
          <Icon icon={PiIdentificationBadge} size={16} />
          {user.clickupId}
        </div>
      </div>

      {/* Last Active */}
      {user.lastActive && (
        <div className="text-sm text-(--color-text-subtle)">
          Active: {new Date(parseInt(user.lastActive)).toLocaleDateString()}
        </div>
      )}
    </div>
  );
};
