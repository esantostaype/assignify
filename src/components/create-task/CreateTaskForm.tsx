/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  FC,
  Dispatch,
  SetStateAction,
} from "react";
import axios from "axios";
import { Formik, Form, useFormikContext } from "formik";
import { Button, Typography, LoadingOverlay, Spinner } from "@/components/ui";
import { hotToast as toast } from "@/lib/hotToast";
import { useQueryClient } from "@tanstack/react-query";

import {
  TaskKindSwitch,
  TaskNameField,
  BrandSelect,
  TierSelect,
  PrioritySelect,
  LevelSelect,
  DurationField,
  UserAssignmentSelect,
  TaskCreatedToastContent,
} from "./";

import { useTaskData, useTaskSuggestion } from "@/hooks";
import { taskKeys } from "@/hooks/queries/useTasks";
// Importa directo del módulo (no del barrel @/utils): el barrel arrastra
// utilidades que tocan la DB (@/db) y contaminaría este bundle de cliente,
// rompiendo el prerender (Element type is invalid).
import { getTypeKind } from "@/utils/taskUtils";
import { validationSchema } from "@/validation/taskValidation";
import { FormValues, User, TaskType } from "@/interfaces";

interface FormikSuggestionLogicProps {
  setSuggestedAssignment: Dispatch<
    SetStateAction<{ userId: string; durationDays: number } | null>
  >;
  setFetchingSuggestion: Dispatch<SetStateAction<boolean>>;
  userHasManuallyChanged: boolean;
  currentTypeId?: number;
  triggerSuggestion: number;
  isSubmitting: boolean;
  setFieldValue: (field: string, value: any) => void;
  setSuggestionChanged: Dispatch<SetStateAction<boolean>>;
}

// Lógica de sugerencia de usuario: depende del tipo (del kind) + duración + brand.
const FormikSuggestionLogic: FC<FormikSuggestionLogicProps> = ({
  setSuggestedAssignment,
  setFetchingSuggestion,
  userHasManuallyChanged,
  currentTypeId,
  triggerSuggestion,
  isSubmitting,
  setFieldValue,
  setSuggestionChanged,
}) => {
  const { values } = useFormikContext<FormValues>();

  const { suggestedAssignment, fetchingSuggestion } = useTaskSuggestion(
    isSubmitting ? undefined : currentTypeId,
    isSubmitting ? "" : (values.durationDays as string),
    isSubmitting ? undefined : values.brandId || undefined,
    isSubmitting ? undefined : values.priority,
    isSubmitting ? 0 : triggerSuggestion,
    isSubmitting ? undefined : values.level
  );

  useEffect(() => {
    if (isSubmitting) return;

    setFetchingSuggestion(fetchingSuggestion);

    const changed =
      suggestedAssignment &&
      values.assignedUserIds.length > 0 &&
      values.assignedUserIds[0] !== suggestedAssignment.userId;

    if (changed) {
      setSuggestionChanged(true);
      setTimeout(() => setSuggestionChanged(false), 4000);
    }

    setSuggestedAssignment(suggestedAssignment);

    if (
      !fetchingSuggestion &&
      !userHasManuallyChanged &&
      values.assignedUserIds.length > 0 &&
      !suggestedAssignment
    ) {
      setFieldValue("assignedUserIds", []);
    }
  }, [
    suggestedAssignment,
    fetchingSuggestion,
    setFieldValue,
    setSuggestedAssignment,
    setFetchingSuggestion,
    values.assignedUserIds,
    userHasManuallyChanged,
    isSubmitting,
    setSuggestionChanged,
  ]);

  return null;
};

// Tiempo de inactividad tras el cual el formulario se reinicia solo (2 min).
const INACTIVITY_RESET_MS = 120000;

interface FormikInactivityResetProps {
  isSubmitting: boolean;
  onInactivityReset: () => void;
}

// Reinicia el formulario por inactividad: si está "sucio" (dirty) y pasan
// 2 minutos sin cambios ni submit, dispara onInactivityReset. El temporizador
// se REINICIA cada vez que cambian los valores del form. No corre si el form
// está limpio ni mientras se está enviando.
const FormikInactivityReset: FC<FormikInactivityResetProps> = ({
  isSubmitting,
  onInactivityReset,
}) => {
  const { values, dirty } = useFormikContext<FormValues>();
  // Guardamos el callback en un ref para que el efecto pueda depender solo de
  // los valores del form (y reinicie el timer al teclear) sin recrearse por
  // cambios de identidad del callback.
  const resetRef = useRef(onInactivityReset);
  resetRef.current = onInactivityReset;

  useEffect(() => {
    // No arrancar el temporizador si el form está limpio o se está enviando.
    if (!dirty || isSubmitting) return;

    const timeoutId = setTimeout(() => {
      resetRef.current();
    }, INACTIVITY_RESET_MS);

    // Limpia al desmontar, al enviar, al dejar de estar dirty y en cada cambio
    // de valores (lo que efectivamente REINICIA la cuenta de 2 minutos).
    return () => clearTimeout(timeoutId);
  }, [values, dirty, isSubmitting]);

  return null;
};

export const CreateTaskForm: FC = () => {
  const queryClient = useQueryClient();

  const { types, brands, users, tiers, loading: dataLoading } = useTaskData();
  const [loading, setLoading] = useState(false);
  const [selectedKind, setSelectedKind] = useState<"UX/UI" | "Graphic">("UX/UI");
  const [triggerSuggestion, setTriggerSuggestion] = useState(0);

  const [suggestedAssignment, setSuggestedAssignment] = useState<{
    userId: string;
    durationDays: number;
  } | null>(null);
  const [fetchingSuggestion, setFetchingSuggestion] = useState(false);
  const [userHasManuallyChanged, setUserHasManuallyChanged] = useState(false);
  const [suggestionChanged, setSuggestionChanged] = useState(false);

  // Reinicia TODO el estado local del formulario a su valor inicial. Se usa
  // tanto tras crear con éxito como en la auto-limpieza por inactividad.
  // (Los valores de Formik —name, tierId, level, etc.— los reinicia resetForm.)
  const resetLocalState = useCallback(() => {
    setSelectedKind("UX/UI");
    setTriggerSuggestion(0);
    setSuggestedAssignment(null);
    setUserHasManuallyChanged(false);
    setSuggestionChanged(false);
  }, []);

  const suggestedUser = suggestedAssignment
    ? users.find((u) => u.id === suggestedAssignment.userId)
    : null;

  // El tipo se determina por el kind seleccionado (UX/UI o Graphic).
  const filteredTypes = (types as TaskType[]).filter(
    (type) => getTypeKind(type.name) === selectedKind
  );
  const currentTypeId = filteredTypes.length > 0 ? filteredTypes[0].id : undefined;

  const initialValues: FormValues = {
    name: "Task 1",
    description: "",
    tierId: "",
    priority: "NORMAL",
    brandId: "",
    assignedUserIds: [],
    durationDays: "",
    level: "MID",
  };

  const handleSubmit = async (values: FormValues, { resetForm }: any) => {
    try {
      if (!currentTypeId) {
        toast.error({ title: "No type found for the selected kind", description: "Pick a different kind." });
        return;
      }

      const selectedTier = tiers.find((t) => t.id.toString() === values.tierId);
      if (!selectedTier) {
        toast.error({ title: "Selected tier not found", description: "Choose a valid tier." });
        return;
      }

      const finalDurationDays = parseFloat(values.durationDays as string);
      if (finalDurationDays <= 0) {
        toast.error({ title: "Task duration must be greater than zero.", description: "Enter a positive value." });
        return;
      }

      const payload = {
        name: values.name.trim(),
        description: values.description.trim() || undefined,
        typeId: currentTypeId,
        tierId: selectedTier.id,
        priority: values.priority,
        brandId: values.brandId,
        assignedUserIds:
          values.assignedUserIds.length > 0 ? values.assignedUserIds : undefined,
        durationDays: finalDurationDays,
        // Nivel solicitado: solo decide el diseñador en asignación automática (no se persiste).
        level: values.level,
      };

      setLoading(true);
      const taskResponse = await axios.post("/api/tasks/parallel", payload);
      const createdTask = taskResponse.data;
      setLoading(false);

      await queryClient.invalidateQueries({ queryKey: taskKeys.clickup() });

      const assignedUserNames =
        createdTask.assignees?.map((a: any) => a.user.name).join(", ") ?? "somebody";

      const fmt = (d: string) =>
        new Date(d).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

      toast.success({ title: <TaskCreatedToastContent
          assignedUserNames={assignedUserNames}
          startDate={fmt(createdTask.startDate)}
          endDate={fmt(createdTask.deadline)}
        /> });

      // Limpia el formulario por completo: valores de Formik + estado local.
      resetForm();
      resetLocalState();
    } catch (error: unknown) {
      setLoading(false);
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        toast.error({ title: "Couldn't create task", description: error.response.data.error });
      } else if (axios.isAxiosError(error) && error.response?.data?.details) {
        toast.error({ title: "Couldn't create task", description: error.response.data.details });
      } else {
        toast.error({ title: "Unexpected error while creating the task", description: "Please try again." });
      }
    }
  };

  const handleUserSelectionChange = (selectedUserIds: string[]) => {
    setUserHasManuallyChanged(true);
    setSuggestionChanged(false);
    return selectedUserIds;
  };

  const applySuggestion = () => {
    setUserHasManuallyChanged(false);
    setSuggestionChanged(false);
  };

  const selectedTierDuration = (tierId: string) =>
    tiers.find((t) => t.id.toString() === tierId)?.duration;

  return (
    <aside className="bg-(--color-surface-app) sticky w-[28rem] p-10 h-dvh overflow-y-auto top-0 border-l border-l-(--color-border-default)">
      <LoadingOverlay open={loading} label="Creating Task..." />
      {fetchingSuggestion && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-primary-500/10 px-3 py-2 text-sm text-primary-600">
          <Spinner size={16} colorClassName="text-primary-600" />
          Finding suggested designer...
        </div>
      )}
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        enableReinitialize={true}
      >
        {({ values, errors, touched, setFieldValue, isSubmitting, resetForm }) => {
          const resetDependentFields = () => {
            setFieldValue("assignedUserIds", []);
            setSuggestedAssignment(null);
            setUserHasManuallyChanged(false);
            setSuggestionChanged(false);
          };

          // Auto-limpieza por inactividad: reinicia Formik + estado local y avisa.
          const handleInactivityReset = () => {
            resetForm();
            resetLocalState();
            toast.neutral({ title: "Form reset due to inactivity", description: "Start a new task." });
          };

          return (
            <Form className="flex flex-col gap-4">
              <FormikSuggestionLogic
                setSuggestedAssignment={setSuggestedAssignment}
                setFetchingSuggestion={setFetchingSuggestion}
                userHasManuallyChanged={userHasManuallyChanged}
                currentTypeId={currentTypeId}
                triggerSuggestion={triggerSuggestion}
                isSubmitting={isSubmitting}
                setFieldValue={setFieldValue}
                setSuggestionChanged={setSuggestionChanged}
              />

              <FormikInactivityReset
                isSubmitting={isSubmitting}
                onInactivityReset={handleInactivityReset}
              />

              <TaskKindSwitch
                selectedKind={selectedKind}
                onKindChange={(kind) => {
                  setSelectedKind(kind);
                  setTimeout(() => {
                    setFieldValue("tierId", "");
                    setFieldValue("durationDays", "");
                    resetDependentFields();
                  }, 0);
                }}
              />

              <TaskNameField touched={touched.name} error={errors.name} />

              <BrandSelect
                brands={brands}
                value={values.brandId}
                onChange={(value) => {
                  setFieldValue("brandId", value);
                  setTimeout(resetDependentFields, 0);
                }}
                touched={touched.brandId}
                error={errors.brandId}
                loading={dataLoading}
              />

              <TierSelect
                tiers={tiers}
                value={values.tierId || null}
                onChange={(tierId) => {
                  setFieldValue("tierId", tierId || "");
                  const duration = tierId ? selectedTierDuration(tierId) : undefined;
                  setFieldValue("durationDays", duration ? duration.toString() : "");
                  setTimeout(() => {
                    resetDependentFields();
                    setTriggerSuggestion((prev) => prev + 1);
                  }, 0);
                }}
                touched={touched.tierId}
                error={errors.tierId}
                loading={dataLoading}
              />

              <LevelSelect
                value={values.level}
                onChange={(value) => {
                  setFieldValue("level", value);
                  // Recalcular el diseñador sugerido al cambiar el nivel solicitado.
                  setTimeout(() => setTriggerSuggestion((prev) => prev + 1), 0);
                }}
                touched={touched.level}
                error={errors.level}
              />

              <PrioritySelect
                value={values.priority}
                onChange={(value) => setFieldValue("priority", value)}
                touched={touched.priority}
                error={errors.priority}
              />

              <DurationField
                fetchingSuggestion={fetchingSuggestion}
                touched={touched.durationDays}
                error={errors.durationDays}
                onDurationComplete={() => setTriggerSuggestion((prev) => prev + 1)}
                tierDuration={values.tierId ? selectedTierDuration(values.tierId) : undefined}
              />

              <UserAssignmentSelect
                users={users}
                values={values.assignedUserIds}
                onChange={(selectedUserIds) => {
                  const newSelection = handleUserSelectionChange(selectedUserIds);
                  setFieldValue("assignedUserIds", newSelection);
                }}
                suggestedUser={suggestedUser}
                fetchingSuggestion={fetchingSuggestion}
                touched={touched.assignedUserIds}
                error={
                  Array.isArray(errors.assignedUserIds)
                    ? errors.assignedUserIds.join(", ")
                    : errors.assignedUserIds
                }
                loading={dataLoading}
                userHasManuallyChanged={userHasManuallyChanged}
                onApplySuggestion={applySuggestion}
                typeId={currentTypeId}
                brandId={values.brandId || undefined}
                durationDays={
                  values.durationDays ? parseFloat(values.durationDays as string) : undefined
                }
                info={{ tierId: values.tierId, brandId: values.brandId }}
              />

              <Button
                type="submit"
                fullWidth
                disabled={loading || isSubmitting || (brands.length === 0 && !dataLoading)}
                size="lg"
                className="mt-4"
              >
                {isSubmitting ? "Creating..." : "Create Task"}
              </Button>

              {brands.length === 0 && !dataLoading && (
                <Typography variant="caption" color="warning-600" className="text-center">
                  No active brands available
                </Typography>
              )}
            </Form>
          );
        }}
      </Formik>
    </aside>
  );
};
