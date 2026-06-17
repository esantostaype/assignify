/* eslint-disable @typescript-eslint/no-unused-vars */
// src/components/designers/AddVacationForm.tsx - ENHANCED VERSION
import React, { useState, useEffect } from 'react';
import { Button, Alert } from '@/components/ui';
import { DateField } from '@/components/ui/date/DateField';
import { Icon, PiPlus, PiWarning } from '@/lib/icons';

/**
 * Las vacaciones son fechas de calendario; el padre (y el endpoint) esperan
 * cadenas 'YYYY-MM-DD'. El DatePicker trabaja con `Date` a medianoche LOCAL,
 * así que convertimos usando componentes locales (NO `toISOString`, que correría
 * el día en zonas con offset negativo, justo lo que el backend evita).
 */
const toDateString = (d: Date | null): string => {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Parsea 'YYYY-MM-DD' a un `Date` a medianoche local (par del DatePicker). */
const parseDateString = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

interface Vacation {
  id: number
  userId: string
  startDate: string
  endDate: string
}

interface AddVacationFormProps {
  onAdd: (startDate: string, endDate: string) => void;
  loading?: boolean;
  existingVacations?: Vacation[];
  userId: string;
}

interface ConflictInfo {
  hasConflict: boolean;
  conflictingVacations: Array<{
    id: number;
    startDate: string;
    endDate: string;
    durationDays: number;
  }>;
  conflictType: 'overlap' | 'adjacent' | 'none';
}

export const AddVacationForm: React.FC<AddVacationFormProps> = ({
  onAdd,
  loading = false,
  existingVacations = [],
  userId
}) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo>({
    hasConflict: false,
    conflictingVacations: [],
    conflictType: 'none'
  });

  // ✅ Function to check for vacation conflicts
  const checkConflicts = (start: string, end: string): ConflictInfo => {
    if (!start || !end) {
      return { hasConflict: false, conflictingVacations: [], conflictType: 'none' };
    }

    const startDateObj = new Date(start);
    const endDateObj = new Date(end);

    if (startDateObj >= endDateObj) {
      return { hasConflict: false, conflictingVacations: [], conflictType: 'none' };
    }

    const conflictingVacations: Array<{
      id: number;
      startDate: string;
      endDate: string;
      durationDays: number;
    }> = [];

    let conflictType: 'overlap' | 'adjacent' | 'none' = 'none';

    for (const vacation of existingVacations) {
      const vacStart = new Date(vacation.startDate);
      const vacEnd = new Date(vacation.endDate);

      // Check for overlap
      const hasOverlap = startDateObj <= vacEnd && endDateObj >= vacStart;

      // Check for adjacency (within 1 day)
      const dayBefore = new Date(vacStart);
      dayBefore.setDate(dayBefore.getDate() - 1);
      const dayAfter = new Date(vacEnd);
      dayAfter.setDate(dayAfter.getDate() + 1);

      const isAdjacent = (
        startDateObj.getTime() === dayAfter.getTime() ||
        endDateObj.getTime() === dayBefore.getTime()
      );

      if (hasOverlap || isAdjacent) {
        const durationDays = Math.ceil(
          (vacEnd.getTime() - vacStart.getTime()) / (1000 * 60 * 60 * 24)
        );

        conflictingVacations.push({
          id: vacation.id,
          startDate: vacation.startDate,
          endDate: vacation.endDate,
          durationDays
        });

        if (hasOverlap) {
          conflictType = 'overlap';
        } else if (isAdjacent && conflictType === 'none') {
          conflictType = 'adjacent';
        }
      }
    }

    return {
      hasConflict: conflictingVacations.length > 0,
      conflictingVacations,
      conflictType
    };
  };

  // ✅ Check conflicts whenever dates change
  useEffect(() => {
    const conflicts = checkConflicts(startDate, endDate);
    setConflictInfo(conflicts);
  }, [startDate, endDate, existingVacations]);

  // ✅ Enhanced validation
  const isFormValid = () => {
    if (!startDate || !endDate) return false;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) return false;

    // Allow form submission even with conflicts (user can decide)
    return true;
  };

  // ✅ Today at local midnight — used as the `min` bound for the pickers.
  const getTodayDate = () => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  };

  const handleAdd = () => {
    if (isFormValid()) {
      // If there are conflicts, user is warned but can still proceed
      onAdd(startDate, endDate);
      setStartDate('');
      setEndDate('');
      setConflictInfo({ hasConflict: false, conflictingVacations: [], conflictType: 'none' });
    }
  };

  const handleStartDateChange = (date: Date | null) => {
    const newStartDate = toDateString(date);
    setStartDate(newStartDate);

    // Auto-adjust end date if it's before start date
    if (endDate && newStartDate && new Date(newStartDate) >= new Date(endDate)) {
      const nextDay = parseDateString(newStartDate);
      if (nextDay) {
        nextDay.setDate(nextDay.getDate() + 1);
        setEndDate(toDateString(nextDay));
      }
    }
  };

  const formatDateForDisplay = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <DateField
            label="Start Date"
            value={parseDateString(startDate)}
            onChange={handleStartDateChange}
            min={getTodayDate()}
            size="sm"
          />
        </div>

        <div className="flex-1">
          <DateField
            label="End Date"
            value={parseDateString(endDate)}
            onChange={(date) => setEndDate(toDateString(date))}
            min={parseDateString(startDate) ?? getTodayDate()}
            size="sm"
          />
        </div>

        <Button
          variant="filled"
          color="primary"
          startIcon={<Icon icon={PiPlus} size={16} />}
          onClick={handleAdd}
          disabled={!isFormValid() || loading}
          loading={loading}
          size="sm"
        >
          Add Vacation
        </Button>
      </div>

      {/* ✅ Conflict warnings */}
      {conflictInfo.hasConflict && (
        <Alert
          tone={conflictInfo.conflictType === 'overlap' ? 'error' : 'warning'}
          variant="soft"
          icon={PiWarning}
          iconSize={20}
        >
          <div>
            <div className="font-medium mb-2">
              {conflictInfo.conflictType === 'overlap'
                ? '⚠️ Date Overlap Detected'
                : '📅 Adjacent Vacation Detected'
              }
            </div>

            <div className="text-sm space-y-1">
              {conflictInfo.conflictType === 'overlap' && (
                <p>The selected dates overlap with existing vacation(s):</p>
              )}
              {conflictInfo.conflictType === 'adjacent' && (
                <p>The selected dates are adjacent to existing vacation(s). Consider merging:</p>
              )}

              <ul className="list-disc list-inside space-y-1 mt-2">
                {conflictInfo.conflictingVacations.map((vacation) => (
                  <li key={vacation.id}>
                    <strong>{formatDateForDisplay(vacation.startDate)}</strong> to{' '}
                    <strong>{formatDateForDisplay(vacation.endDate)}</strong>
                    {' '}({vacation.durationDays} days)
                  </li>
                ))}
              </ul>

              {conflictInfo.conflictType === 'overlap' && (
                <p className="mt-2 text-xs opacity-80">
                  Please adjust the dates to avoid overlap, or delete the conflicting vacation first.
                </p>
              )}
              {conflictInfo.conflictType === 'adjacent' && (
                <p className="mt-2 text-xs opacity-80">
                  You can still add this vacation, but consider if you want to merge them instead.
                </p>
              )}
            </div>
          </div>
        </Alert>
      )}

      {/* ✅ Validation message for invalid date range */}
      {startDate && endDate && new Date(startDate) >= new Date(endDate) && (
        <Alert tone="error" variant="soft">
          End date must be after start date
        </Alert>
      )}

      {/* ✅ Duration preview */}
      {startDate && endDate && new Date(startDate) < new Date(endDate) && (
        <div className="text-sm text-(--color-text-subtle)">
          Duration: {Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))} days
        </div>
      )}
    </div>
  );
};
