"use client";

import React, { useEffect, useMemo, useRef } from "react";
import { MultiSelect, Button, Alert } from "@/components/ui";
import type { SelectOption } from "@/components/ui";
import { cn } from "@/lib/cn";
import { User, RankedCandidate, MemberStatus } from "@/interfaces";
import {
  Icon,
  PiUserCheck,
  PiArrowsClockwise,
  PiSparkle,
  PiCalendarBlank,
  PiClock,
} from "@/lib/icons";
import type { IconComponent } from "@/lib/icons";

interface UserAssignmentSelectProps {
  users: User[]; // Fallback: nombres mientras no hay candidatos del motor.
  candidates: RankedCandidate[]; // Fuente única: motor de sugerencia.
  suggestedUserId?: string | null;
  values: string[];
  info?: { tierId: string; brandId: string };
  onChange: (value: string[]) => void;
  // Selección PROGRAMÁTICA (auto-seguir la sugerencia): no marca "cambio manual".
  onAutoApply: (value: string[]) => void;
  fetchingSuggestion: boolean;
  touched: boolean | undefined;
  error: string | undefined;
  loading?: boolean;
  userHasManuallyChanged?: boolean;
  onApplySuggestion?: () => void;
}

// "suggested" no es un MemberStatus real: es un marcador visual para el
// candidato que el motor recomienda.
type BadgeKind = "suggested" | MemberStatus;

const BADGE_TEXT: Record<BadgeKind, string> = {
  suggested: "Suggested",
  available: "Available",
  on_vacation: "On Vacation",
  overloaded: "Overloaded",
};

const BADGE_CLASS: Record<BadgeKind, string> = {
  suggested: "bg-success-100 text-success-700",
  available: "bg-primary-100 text-primary-700",
  on_vacation: "bg-warning-100 text-warning-700",
  overloaded: "bg-error-100 text-error-700",
};

const BADGE_ICON: Record<BadgeKind, IconComponent> = {
  suggested: PiSparkle,
  available: PiUserCheck,
  on_vacation: PiCalendarBlank,
  overloaded: PiClock,
};

export const UserAssignmentSelect: React.FC<UserAssignmentSelectProps> = ({
  users,
  candidates,
  suggestedUserId,
  values,
  info,
  onChange,
  onAutoApply,
  fetchingSuggestion,
  touched,
  error,
  loading = false,
  userHasManuallyChanged = false,
  onApplySuggestion,
}) => {
  // Evita re-aplicar la misma sugerencia en bucle.
  const lastAppliedSuggestionRef = useRef<string | null>(null);

  const candidateById = useMemo(
    () => new Map(candidates.map((c) => [c.userId, c])),
    [candidates]
  );

  const suggestedCandidate = suggestedUserId ? candidateById.get(suggestedUserId) : undefined;
  const suggestedName =
    suggestedCandidate?.userName ||
    users.find((u) => u.id === suggestedUserId)?.name ||
    null;
  const suggestedReason = suggestedCandidate?.reason ?? null;

  const isLoading = loading || fetchingSuggestion;

  // El selector SIGUE a la sugerencia mientras el usuario no la cambie a mano.
  // Así nunca queda un diseñador "viejo" seleccionado cuando el motor sugiere otro.
  useEffect(() => {
    if (fetchingSuggestion || !suggestedUserId || userHasManuallyChanged) return;
    if (values.length === 1 && values[0] === suggestedUserId) {
      lastAppliedSuggestionRef.current = suggestedUserId;
      return;
    }
    if (lastAppliedSuggestionRef.current === suggestedUserId && values.length > 0) return;

    requestAnimationFrame(() => {
      onAutoApply([suggestedUserId]);
      lastAppliedSuggestionRef.current = suggestedUserId;
    });
  }, [suggestedUserId, fetchingSuggestion, userHasManuallyChanged, values, onAutoApply]);

  // Aviso si el diseñador elegido a mano está de vacaciones.
  const vacationWarnings = useMemo(() => {
    return values
      .map((id) => candidateById.get(id))
      .filter((c): c is RankedCandidate => !!c && c.status === "on_vacation")
      .map((c) => `${c.userName} is on vacation — the task would start on ${c.availableFrom}.`);
  }, [values, candidateById]);

  // Mostrar el aviso de sugerencia solo si el usuario eligió a alguien distinto.
  const showSuggestionHint =
    !fetchingSuggestion &&
    suggestedUserId &&
    suggestedName &&
    userHasManuallyChanged &&
    !values.includes(suggestedUserId);

  const badgeKindOf = (id: string): BadgeKind | null => {
    if (id === suggestedUserId) return "suggested";
    const cand = candidateById.get(id);
    return cand ? cand.status : null;
  };

  // Opciones: candidatos del motor; si aún no hay (sin tier/duración), los users
  // como fallback plano. Se incluyen siempre los ya seleccionados para no perder chips.
  const options: SelectOption<string>[] = useMemo(() => {
    const baseIds =
      candidates.length > 0 ? candidates.map((c) => c.userId) : users.map((u) => u.id);
    const ids = Array.from(new Set([...baseIds, ...values]));

    return ids.map((id) => {
      const name = candidateById.get(id)?.userName ?? users.find((u) => u.id === id)?.name ?? id;
      const kind = badgeKindOf(id);
      const BadgeIcon = kind ? BADGE_ICON[kind] : PiUserCheck;

      return {
        value: id,
        searchValue: name,
        label: (
          <div className="flex w-full items-center justify-between gap-2">
            <span className="flex items-center gap-2 min-w-0">
              <Icon icon={BadgeIcon} size={16} className="shrink-0" />
              <span className="truncate">{name}</span>
            </span>
            {kind && (
              <span
                className={cn(
                  "shrink-0 rounded-sm px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide leading-none",
                  BADGE_CLASS[kind]
                )}
              >
                {BADGE_TEXT[kind]}
              </span>
            )}
          </div>
        ),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, users, values, candidateById, suggestedUserId]);

  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-semibold text-(--color-text-default) mb-1.5">
        <Icon icon={PiUserCheck} size={20} />
        Assignee
      </label>

      {showSuggestionHint && (
        <div className="mb-3 flex items-start justify-between gap-2 rounded-lg bg-success-500/10 p-3">
          <span className="text-sm text-(--color-text-default)">
            Suggested: <strong>{suggestedName}</strong>
            {suggestedReason && (
              <span className="mt-0.5 block text-xs text-(--color-text-muted)">{suggestedReason}</span>
            )}
          </span>
          {onApplySuggestion && (
            <Button
              size="sm"
              variant="soft"
              color="success"
              onClick={() => {
                onChange([suggestedUserId!]);
                lastAppliedSuggestionRef.current = suggestedUserId!;
                onApplySuggestion();
              }}
              startIcon={<Icon icon={PiArrowsClockwise} size={16} />}
            >
              Apply
            </Button>
          )}
        </div>
      )}

      {vacationWarnings.length > 0 && (
        <div className="mb-3 space-y-2">
          {vacationWarnings.map((warning, index) => (
            <Alert key={index} tone="warning" variant="soft" icon={PiCalendarBlank}>
              <div className="text-xs">{warning}</div>
            </Alert>
          ))}
        </div>
      )}

      <MultiSelect
        name="assignedUserIds"
        searchable
        value={values}
        options={options}
        onChange={(val) => onChange(val)}
        placeholder={fetchingSuggestion ? "Searching for suggestion..." : "Assign member(s)"}
        disabled={isLoading || !info?.tierId || !info?.brandId}
        error={touched && error ? error : undefined}
        noResultsLabel="No compatible members found"
      />

      {/* "Por qué" del sugerido cuando es la selección activa (genera confianza). */}
      {!fetchingSuggestion &&
        suggestedReason &&
        suggestedUserId &&
        values.includes(suggestedUserId) && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-(--color-text-muted)">
            <Icon icon={PiSparkle} size={12} className="shrink-0 text-success-600" />
            {suggestedReason}
          </p>
        )}
    </div>
  );
};
