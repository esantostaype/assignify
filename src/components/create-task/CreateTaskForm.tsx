/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useEffect, FC, Dispatch, SetStateAction } from "react";
import axios from "axios";
import { Formik, Form, useFormikContext } from "formik";
import { Button, Typography } from "@/components/ui";
import toast from "react-hot-toast";
import { useQueryClient } from "@tanstack/react-query";

import { SpinnerCreatingTask, SpinnerSearching } from "@/components";
import {
  TaskKindSwitch,
  TaskNameField,
  BrandSelect,
  TierSelect,
  PrioritySelect,
  DurationField,
  UserAssignmentSelect,
  TaskCreatedToastContent,
} from "./";

import { useTaskData, useTaskSuggestion } from "@/hooks";
import { taskKeys } from "@/hooks/queries/useTasks";
import { getTypeKind } from "@/utils";
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
    isSubmitting ? 0 : triggerSuggestion
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
  };

  const handleSubmit = async (values: FormValues, { resetForm }: any) => {
    try {
      if (!currentTypeId) {
        toast.error("No type found for the selected kind");
        return;
      }

      const selectedTier = tiers.find((t) => t.id.toString() === values.tierId);
      if (!selectedTier) {
        toast.error("Selected tier not found");
        return;
      }

      const finalDurationDays = parseFloat(values.durationDays as string);
      if (finalDurationDays <= 0) {
        toast.error("La duración de la tarea debe ser mayor a cero.");
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
      };

      setLoading(true);
      const taskResponse = await axios.post("/api/tasks/parallel", payload);
      const createdTask = taskResponse.data;
      setLoading(false);

      await queryClient.invalidateQueries({ queryKey: taskKeys.clickup() });

      const assignedUserNames =
        createdTask.assignees?.map((a: any) => a.user.name).join(", ") ?? "somebody";

      const fmt = (d: string) =>
        new Date(d).toLocaleDateString("es-PE", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

      toast.success(
        <TaskCreatedToastContent
          assignedUserNames={assignedUserNames}
          startDate={fmt(createdTask.startDate)}
          endDate={fmt(createdTask.deadline)}
        />
      );

      setUserHasManuallyChanged(false);
      setSuggestionChanged(false);
      resetForm();
    } catch (error: unknown) {
      setLoading(false);
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else if (axios.isAxiosError(error) && error.response?.data?.details) {
        toast.error(`Error: ${error.response.data.details}`);
      } else {
        toast.error("Error inesperado al crear la tarea");
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
      <SpinnerCreatingTask isActive={loading} />
      <SpinnerSearching isActive={fetchingSuggestion} />
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        enableReinitialize={true}
      >
        {({ values, errors, touched, setFieldValue, isSubmitting }) => {
          const resetDependentFields = () => {
            setFieldValue("assignedUserIds", []);
            setSuggestedAssignment(null);
            setUserHasManuallyChanged(false);
            setSuggestionChanged(false);
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
                  No hay brands activos disponibles
                </Typography>
              )}
            </Form>
          );
        }}
      </Formik>
    </aside>
  );
};
