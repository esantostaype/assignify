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
import { Icon, PiSparkle } from "@/lib/icons";
import { hotToast as toast } from "@/lib/hotToast";
import { useQueryClient } from "@tanstack/react-query";

import {
  TaskTypeSelect,
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
import { validationSchema } from "@/validation/taskValidation";
import { FormValues, RankedCandidate } from "@/interfaces";
import { unitToDays, daysToUnit, type DurationUnit } from "@/utils/duration-utils";

interface FormikSuggestionLogicProps {
  setSuggestedAssignment: Dispatch<
    SetStateAction<{ userId: string; durationDays: number } | null>
  >;
  setCandidates: Dispatch<SetStateAction<RankedCandidate[]>>;
  setFetchingSuggestion: Dispatch<SetStateAction<boolean>>;
  userHasManuallyChanged: boolean;
  currentTypeId?: number;
  triggerSuggestion: number;
  isSubmitting: boolean;
  setFieldValue: (field: string, value: any) => void;
  durationUnit: DurationUnit;
}

// Lógica de sugerencia de usuario: depende del tipo (del kind) + duración + brand
// + prioridad + nivel. Llama al motor (vía useTaskSuggestion) y eleva el resultado
// (sugerido + candidatos) al formulario. La SELECCIÓN automática del sugerido la
// hace UserAssignmentSelect (sigue a la sugerencia mientras no se cambie a mano).
const FormikSuggestionLogic: FC<FormikSuggestionLogicProps> = ({
  setSuggestedAssignment,
  setCandidates,
  setFetchingSuggestion,
  userHasManuallyChanged,
  currentTypeId,
  triggerSuggestion,
  isSubmitting,
  setFieldValue,
  durationUnit,
}) => {
  const { values } = useFormikContext<FormValues>();

  // El form maneja la duración EN LA UNIDAD del workspace; el motor espera días base.
  const durationDaysBase = values.durationDays
    ? unitToDays(parseFloat(values.durationDays as string), durationUnit).toString()
    : "";

  const { suggestedAssignment, candidates, fetchingSuggestion } = useTaskSuggestion(
    isSubmitting ? undefined : currentTypeId,
    isSubmitting ? "" : durationDaysBase,
    isSubmitting ? undefined : values.brandId || undefined,
    isSubmitting ? undefined : values.priority,
    isSubmitting ? 0 : triggerSuggestion,
    isSubmitting ? undefined : values.level
  );

  useEffect(() => {
    if (isSubmitting) return;

    setFetchingSuggestion(fetchingSuggestion);
    setSuggestedAssignment(suggestedAssignment);
    setCandidates(candidates);

    // Si el motor no puede sugerir a nadie y el usuario no eligió a mano, limpia.
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
    candidates,
    fetchingSuggestion,
    setFieldValue,
    setSuggestedAssignment,
    setCandidates,
    setFetchingSuggestion,
    values.assignedUserIds,
    userHasManuallyChanged,
    isSubmitting,
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

// Se monta en la página /create o en el modal interceptado (desktop). `onCreated` lo
// usa el modal para cerrarse (router.back) tras crear con éxito.
export const CreateTaskForm: FC<{ onCreated?: () => void }> = ({ onCreated }) => {
  const queryClient = useQueryClient();

  const { types, brands, users, tiers, durationUnit, loading: dataLoading } = useTaskData();
  const [loading, setLoading] = useState(false);
  // [SaaS] Tipo de tarea elegido (id), de los tipos PROPIOS del workspace.
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [triggerSuggestion, setTriggerSuggestion] = useState(0);

  const [suggestedAssignment, setSuggestedAssignment] = useState<{
    userId: string;
    durationDays: number;
  } | null>(null);
  const [candidates, setCandidates] = useState<RankedCandidate[]>([]);
  const [fetchingSuggestion, setFetchingSuggestion] = useState(false);
  const [userHasManuallyChanged, setUserHasManuallyChanged] = useState(false);

  // Reinicia TODO el estado local del formulario a su valor inicial. Se usa
  // tanto tras crear con éxito como en la auto-limpieza por inactividad.
  // (Los valores de Formik —name, tierId, level, etc.— los reinicia resetForm.)
  const resetLocalState = useCallback(() => {
    setSelectedTypeId(null);
    setTriggerSuggestion(0);
    setSuggestedAssignment(null);
    setCandidates([]);
    setUserHasManuallyChanged(false);
  }, []);

  // El tipo lo elige el usuario directamente entre los tipos del workspace.
  const currentTypeId = selectedTypeId ? parseInt(selectedTypeId) : undefined;

  // Formulario SIEMPRE vacío al abrir/limpiar: el usuario elige cada campo.
  const initialValues: FormValues = {
    name: "",
    description: "",
    tierId: "",
    priority: "",
    brandId: "",
    assignedUserIds: [],
    durationDays: "",
    level: "",
  };

  const handleSubmit = async (values: FormValues, { resetForm }: any) => {
    try {
      if (!currentTypeId) {
        toast.error({ title: "Select a task type", description: "Pick one of your workspace's task types." });
        return;
      }

      const selectedTier = tiers.find((t) => t.id.toString() === values.tierId);
      if (!selectedTier) {
        toast.error({ title: "Selected tier not found", description: "Choose a valid tier." });
        return;
      }

      // El form trabaja en la unidad del workspace; el backend espera días base.
      const finalDurationDays = unitToDays(parseFloat(values.durationDays as string), durationUnit);
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
        // Lo que el motor sugirió en pantalla (para medir aciertos vs. override). No decide nada.
        suggestedUserId: suggestedAssignment?.userId ?? null,
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
      // En modal/página: avisar al contenedor (p.ej. cerrar el modal y volver atrás).
      onCreated?.();
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
    return selectedUserIds;
  };

  const applySuggestion = () => {
    setUserHasManuallyChanged(false);
  };

  // Duración del tier EN LA UNIDAD del workspace (lo que el form muestra/edita).
  const selectedTierDuration = (tierId: string) => {
    const d = tiers.find((t) => t.id.toString() === tierId)?.duration;
    return d !== undefined ? Math.round(daysToUnit(d, durationUnit) * 100) / 100 : undefined;
  };

  return (
    // Contenedor flexible (sin ancho/posición fijos): el ancho/padding los da la página
    // (/create) o el modal interceptado. `relative` para anclar el overlay de búsqueda.
    <div className="relative">
      <LoadingOverlay open={loading} label="Creating Task..." />

      {/* Bloqueo del formulario mientras el motor busca diseñador: fondo oscuro
          al 70% + blur, con icono y mensaje al centro. */}
      {fetchingSuggestion && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-sm">
          <div className="relative flex items-center justify-center">
            <Spinner size={48} colorClassName="text-white" />
            <Icon
              icon={PiSparkle}
              size={20}
              className="absolute text-white"
            />
          </div>
          <Typography variant="bodySm" color="white" className="font-medium">
            Finding the best match...
          </Typography>
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
            setCandidates([]);
            setUserHasManuallyChanged(false);
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
                setCandidates={setCandidates}
                setFetchingSuggestion={setFetchingSuggestion}
                userHasManuallyChanged={userHasManuallyChanged}
                currentTypeId={currentTypeId}
                triggerSuggestion={triggerSuggestion}
                isSubmitting={isSubmitting}
                setFieldValue={setFieldValue}
                durationUnit={durationUnit}
              />

              <FormikInactivityReset
                isSubmitting={isSubmitting}
                onInactivityReset={handleInactivityReset}
              />

              <TaskTypeSelect
                types={types}
                value={selectedTypeId}
                onChange={(typeId) => {
                  setSelectedTypeId(typeId);
                  setTimeout(() => {
                    setFieldValue("tierId", "");
                    setFieldValue("durationDays", "");
                    resetDependentFields();
                    setTriggerSuggestion((prev) => prev + 1);
                  }, 0);
                }}
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
                unit={durationUnit}
              />

              <PrioritySelect
                value={values.priority}
                onChange={(value) => setFieldValue("priority", value)}
                touched={touched.priority}
                error={errors.priority}
              />

              <DurationField
                touched={touched.durationDays}
                error={errors.durationDays}
                onDurationComplete={() => setTriggerSuggestion((prev) => prev + 1)}
                tierDuration={values.tierId ? selectedTierDuration(values.tierId) : undefined}
                unit={durationUnit}
              />

              <UserAssignmentSelect
                users={users}
                candidates={candidates}
                suggestedUserId={suggestedAssignment?.userId ?? null}
                values={values.assignedUserIds}
                onChange={(selectedUserIds) => {
                  const newSelection = handleUserSelectionChange(selectedUserIds);
                  setFieldValue("assignedUserIds", newSelection);
                }}
                onAutoApply={(ids) => setFieldValue("assignedUserIds", ids)}
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
    </div>
  );
};
