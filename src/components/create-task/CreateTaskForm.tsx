/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, {
  useState,
  useEffect,
  FC,
  Dispatch,
  SetStateAction,
  useRef,
} from "react";
import axios from "axios";
import { Formik, Form, useFormikContext } from "formik";
import { Button, Typography } from "@mui/joy";
import { toast } from "react-toastify";
import { Tier } from "@prisma/client";
import { useQueryClient } from "@tanstack/react-query"; // ✅ NUEVO IMPORT

import { SpinnerCreatingTask, SpinnerSearching } from "@/components";
import {
  TaskKindSwitch,
  TaskNameField,
  BrandSelect,
  CategorySelect,
  PrioritySelect,
  DurationField,
  UserAssignmentSelect,
  TaskCreatedToastContent,
} from "./";

import { useTaskData, useTaskSuggestion } from "@/hooks";
import { taskKeys } from "@/hooks/queries/useTasks"; // ✅ NUEVO IMPORT
import { getTypeKind } from "@/utils";
import { validationSchema } from "@/validation/taskValidation";
import { FormValues, User, TaskType } from "@/interfaces";

interface ExtendedFormValues extends FormValues {
  newCategoryTier: Tier | null;
  isNewCategory: boolean;
  newCategoryName: string;
}

interface FormikSuggestionLogicProps {
  users: User[];
  setSuggestedAssignment: Dispatch<
    SetStateAction<{ userId: string; durationDays: number } | null>
  >;
  setFetchingSuggestion: Dispatch<SetStateAction<boolean>>;
  resetCategory: boolean;
  setResetCategory: Dispatch<SetStateAction<boolean>>;
  userHasManuallyChanged: boolean;
  setUserHasManuallyChanged: Dispatch<SetStateAction<boolean>>;
  isNewCategory: boolean;
  types: TaskType[];
  selectedKind: "UX/UI" | "Graphic";
  triggerSuggestion: number;
  isSubmitting: boolean;
  allCategories: any[];
  setSuggestionChanged: Dispatch<SetStateAction<boolean>>;
  forceSuggestionUpdate?: () => void;
}

// src/components/create-task/CreateTaskForm.tsx - CORRECCIÓN DE DURACIÓN MANUAL

const FormikSuggestionLogic: FC<FormikSuggestionLogicProps> = ({
  setSuggestedAssignment,
  setFetchingSuggestion,
  resetCategory,
  setResetCategory,
  userHasManuallyChanged,
  setUserHasManuallyChanged,
  isNewCategory,
  types,
  selectedKind,
  triggerSuggestion,
  isSubmitting,
  allCategories,
  setSuggestionChanged,
  forceSuggestionUpdate,
}) => {
  const { values, setFieldValue } = useFormikContext<ExtendedFormValues>();

  const [durationManuallyEdited, setDurationManuallyEdited] = useState(false);
  
  // ✅ NUEVO: Flag para evitar aplicaciones simultáneas
  const applyingChangesRef = useRef(false);
  // ✅ NUEVO: Referencia para trackear la última categoría procesada
  const lastProcessedCategoryRef = useRef<string>('');

  // Obtener el typeId para cualquier caso (nueva categoría o existente)
  const getCurrentTypeId = () => {
    if (isNewCategory) {
      const filteredTypes = types.filter((type) => {
        const typeKind = getTypeKind(type.name);
        return typeKind === selectedKind;
      });
      return filteredTypes.length > 0 ? filteredTypes[0].id : undefined;
    } else if (values.categoryId) {
      const selectedCategory = allCategories.find(
        (cat) => cat.id.toString() === values.categoryId
      );
      return selectedCategory?.typeId;
    }
    return undefined;
  };

  const currentTypeId = getCurrentTypeId();

  // ✅ CORREGIDO: Efecto para aplicar duración de categoría existente SOLO cuando cambia la categoría
  useEffect(() => {
    // Evitar aplicar durante resets o cambios simultáneos
    if (applyingChangesRef.current || resetCategory || isSubmitting) {
      return;
    }

    // ✅ NUEVO: Solo aplicar si la categoría cambió realmente
    const currentCategoryKey = `${values.categoryId}-${isNewCategory}`;
    if (lastProcessedCategoryRef.current === currentCategoryKey) {
      return; // No hacer nada si es la misma categoría
    }

    if (!isNewCategory && values.categoryId && !durationManuallyEdited) {
      console.log("🔍 Category changed, applying default duration...");

      const selectedCategory = allCategories.find(
        (cat) => cat.id.toString() === values.categoryId
      );

      if (selectedCategory?.tierList?.duration) {
        const newDuration = selectedCategory.tierList.duration.toString();
        
        // Solo aplicar si es diferente al valor actual
        if (values.durationDays !== newDuration) {
          console.log(`✅ Setting duration from category: ${newDuration} days`);
          
          applyingChangesRef.current = true;
          setFieldValue("durationDays", newDuration);
          
          // Reset flag después de aplicar
          requestAnimationFrame(() => {
            applyingChangesRef.current = false;
          });
        }
      }
    }

    // ✅ ACTUALIZAR referencia de categoría procesada
    lastProcessedCategoryRef.current = currentCategoryKey;

  }, [
    values.categoryId,
    isNewCategory,
    allCategories,
    setFieldValue,
    durationManuallyEdited,
    resetCategory,
    isSubmitting
  ]);

  // ✅ CORREGIDO: Detectar cambios manuales en duración con mejor lógica
  useEffect(() => {
    // No marcar como manual si estamos aplicando cambios automáticos
    if (applyingChangesRef.current || !values.durationDays) {
      return;
    }

    // ✅ NUEVO: Solo marcar como manual si realmente el usuario editó
    // Verificar si la duración actual es diferente a la duración por defecto de la categoría
    if (!isNewCategory && values.categoryId) {
      const selectedCategory = allCategories.find(
        (cat) => cat.id.toString() === values.categoryId
      );
      
      if (selectedCategory?.tierList?.duration) {
        const categoryDuration = selectedCategory.tierList.duration.toString();
        const currentDuration = values.durationDays as string;
        
        // Si la duración actual es diferente a la de la categoría, es manual
        if (currentDuration !== categoryDuration && currentDuration.trim() !== '') {
          const timeout = setTimeout(() => {
            console.log(`🔧 Duration manually edited: ${currentDuration} vs category default: ${categoryDuration}`);
            setDurationManuallyEdited(true);
          }, 300); // Reducir el debounce

          return () => clearTimeout(timeout);
        }
      }
    } else if (isNewCategory && values.durationDays) {
      // Para nuevas categorías, cualquier input es manual
      const timeout = setTimeout(() => {
        console.log(`🔧 Duration manually set for new category: ${values.durationDays}`);
        setDurationManuallyEdited(true);
      }, 300);

      return () => clearTimeout(timeout);
    }
  }, [values.durationDays, values.categoryId, isNewCategory, allCategories]);

  // ✅ CORREGIDO: Resetear cuando cambia categoría o tipo, pero preservar si fue editado manualmente
  useEffect(() => {
    console.log(`🔄 Category/type changed, resetting manual edit flag`);
    setDurationManuallyEdited(false);
    lastProcessedCategoryRef.current = ''; // Reset de la referencia
  }, [values.categoryId, values.isNewCategory, selectedKind]);

  // Hook de sugerencias con función de forzar update
  const {
    suggestedAssignment,
    fetchingSuggestion,
    forceSuggestionUpdate: hookForceSuggestionUpdate,
  } = useTaskSuggestion(
    isSubmitting ? undefined : currentTypeId,
    isSubmitting ? "" : (values.durationDays as string),
    isSubmitting ? undefined : values.brandId || undefined,
    isSubmitting ? 0 : triggerSuggestion
  );

  // Exponer función de forzar update al componente padre
  useEffect(() => {
    if (forceSuggestionUpdate && hookForceSuggestionUpdate()) {
      console.log("🔗 Linking force suggestion update function");
    }
  }, [forceSuggestionUpdate, hookForceSuggestionUpdate]);

  // ✅ OPTIMIZADO: Reset de categoría con protección
  useEffect(() => {
    if (!resetCategory) return;

    console.log("🔄 Resetting category...");
    
    applyingChangesRef.current = true;
    
    // Aplicar todos los resets de una vez
    Promise.resolve().then(() => {
      setFieldValue("categoryId", "");
      setFieldValue("isNewCategory", false);
      setFieldValue("newCategoryName", "");
      setFieldValue("newCategoryTier", null);
      setFieldValue("assignedUserIds", []);
      setFieldValue("durationDays", "");
    }).then(() => {
      setResetCategory(false);
      setUserHasManuallyChanged(false);
      setDurationManuallyEdited(false);
      setSuggestedAssignment(null);
      lastProcessedCategoryRef.current = ''; // Reset de la referencia
      
      requestAnimationFrame(() => {
        applyingChangesRef.current = false;
      });
    });
  }, [
    resetCategory,
    setFieldValue,
    setResetCategory,
    setUserHasManuallyChanged,
    setSuggestedAssignment
  ]);

  // ✅ OPTIMIZADO: Manejo de sugerencias con protección contra loops
  useEffect(() => {
    if (isSubmitting || applyingChangesRef.current) {
      return;
    }

    setFetchingSuggestion(fetchingSuggestion);

    // Detectar cambios en la sugerencia
    const suggestionChanged =
      suggestedAssignment &&
      values.assignedUserIds.length > 0 &&
      values.assignedUserIds[0] !== suggestedAssignment.userId;

    if (suggestionChanged) {
      console.log(
        `🔄 Suggestion changed from ${values.assignedUserIds[0]} to ${suggestedAssignment.userId}`
      );
      setSuggestionChanged(true);
      setTimeout(() => setSuggestionChanged(false), 4000);
    }

    setSuggestedAssignment(suggestedAssignment);

    // ✅ NUEVA LÓGICA: Solo aplicar sugerencia si no hay cambios manuales Y no estamos aplicando otros cambios
    if (suggestedAssignment && !userHasManuallyChanged && !applyingChangesRef.current) {
      console.log(`🤖 New suggestion available: ${suggestedAssignment.userId}`);
      
      // No aplicar automáticamente aquí - dejar que UserAssignmentSelect lo maneje
      // Esto evita el conflicto de múltiples componentes aplicando el mismo cambio
    } else if (
      !fetchingSuggestion &&
      !userHasManuallyChanged &&
      values.assignedUserIds.length > 0 &&
      !suggestedAssignment
    ) {
      console.log("🗑️ Clearing assignment - no suggestion available");
      setFieldValue("assignedUserIds", []);
    }
  }, [
    suggestedAssignment,
    fetchingSuggestion,
    setFieldValue,
    setSuggestedAssignment,
    setFetchingSuggestion,
    values.assignedUserIds.length, // ✅ Solo la longitud para evitar loops
    userHasManuallyChanged,
    isSubmitting,
    setSuggestionChanged,
  ]);

  return null;
};

export const CreateTaskForm: FC = () => {
  const queryClient = useQueryClient(); // ✅ NUEVO: Hook de React Query
  
  const {
    types,
    brands,
    users,
    tiers,
    loading: dataLoading,
    refreshTypes,
  } = useTaskData();
  const [loading, setLoading] = useState(false);
  const [selectedKind, setSelectedKind] = useState<"UX/UI" | "Graphic">(
    "UX/UI"
  );
  const [resetCategory, setResetCategory] = useState(false);

  const [isTypingNewCategory, setIsTypingNewCategory] = useState(false);
  const [triggerSuggestion, setTriggerSuggestion] = useState(0);

  const [suggestedAssignment, setSuggestedAssignment] = useState<{
    userId: string;
    durationDays: number;
  } | null>(null);
  const [fetchingSuggestion, setFetchingSuggestion] = useState(false);
  const [userHasManuallyChanged, setUserHasManuallyChanged] =
    useState<boolean>(false);

  // Estados para detectar cambios de sugerencia
  const [suggestionChanged, setSuggestionChanged] = useState(false);

  const suggestedUser = suggestedAssignment
    ? users.find((u) => u.id === suggestedAssignment.userId)
    : null;

  useEffect(() => {
    setResetCategory(true);
    setUserHasManuallyChanged(false);
    setIsTypingNewCategory(false);
  }, [selectedKind]);

  const getFilteredTypes = () => {
    return types.filter((type) => {
      const typeKind = getTypeKind(type.name);
      return typeKind === selectedKind;
    });
  };

  const filteredTypes = getFilteredTypes();

  const getAllCategories = () => {
    return filteredTypes.flatMap((type) =>
      type.categories.map((cat) => ({
        ...cat,
        typeName: type.name,
      }))
    );
  };

  const allCategories = getAllCategories();
  console.log('📊 Estructura de categorías:', allCategories[0]);

  const initialValues: ExtendedFormValues = {
    name: "Task 1",
    description: "",
    categoryId: "",
    priority: "NORMAL",
    brandId: "",
    assignedUserIds: [],
    durationDays: "",
    newCategoryTier: null,
    isNewCategory: false,
    newCategoryName: "",
  };

  const handleSubmit = async (
    values: ExtendedFormValues,
    { resetForm }: any
  ) => {
    try {
      let finalCategoryId = values.categoryId;
      let finalTypeId: number;
      let newCategoryCreated = false;
      let effectiveCategoryDuration: number

      if (values.isNewCategory) {
      if (!values.newCategoryName.trim()) {
        toast.error("Category name is required for new category");
        return;
      }

      if (!values.newCategoryTier) {
        toast.error("Tier selection is required for new category");
        return;
      }

      // ✅ BUSCAR EL TIER SELECCIONADO para obtener la duración
      const selectedTier = tiers.find(
        (t) => t.name === values.newCategoryTier
      );
      if (!selectedTier) {
        toast.error("Selected tier not found");
        return;
      }

      const selectedType = filteredTypes[0];
      if (!selectedType) {
        toast.error("No type found for the selected kind");
        return;
      }

      finalTypeId = selectedType.id;
      effectiveCategoryDuration = selectedTier.duration; // ✅ USAR DURACIÓN DEL TIER

      console.log(
        `🆕 Creando nueva categoría: (name: ${values.newCategoryName.trim()}, tierId: ${
          selectedTier.id
        }, typeId: ${finalTypeId})`
      );

      const categoryResponse = await axios.post("/api/categories", {
        name: values.newCategoryName.trim(),
        tierId: selectedTier.id,
        typeId: finalTypeId,
      });

      finalCategoryId = categoryResponse.data.id.toString();
      newCategoryCreated = true;
      console.log(`✅ Nueva categoría creada con ID: ${finalCategoryId}`);
    } else {
      // ✅ PARA CATEGORÍA EXISTENTE
      const selectedCategory = allCategories.find(
        (cat) => cat.id.toString() === values.categoryId
      );
      if (!selectedCategory) {
        toast.error("Categoría seleccionada no encontrada");
        return;
      }
      finalTypeId = selectedCategory.typeId;
      effectiveCategoryDuration = selectedCategory.tierList.duration; // ✅ USAR DURACIÓN DE LA CATEGORÍA
    }

    const finalDurationDays = parseFloat(values.durationDays as string);

    if (finalDurationDays <= 0) {
      toast.error("La duración de la tarea debe ser mayor a cero.");
      return;
    }

    // ✅ AHORA LA COMPARACIÓN ES CORRECTA
    const isCustomDuration = finalDurationDays !== effectiveCategoryDuration;
    
    console.log(`🔍 Comparación de duración:`);
    console.log(`   - Duración ingresada: ${finalDurationDays} días`);
    console.log(`   - Duración de categoría: ${effectiveCategoryDuration} días`);
    console.log(`   - Es duración personalizada: ${isCustomDuration}`);

    const payload = {
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      typeId: finalTypeId,
      categoryId: Number(finalCategoryId),
      priority: values.priority,
      brandId: values.brandId,
      assignedUserIds:
        values.assignedUserIds.length > 0
          ? values.assignedUserIds
          : undefined,
      durationDays: finalDurationDays,
    };

    setLoading(true);

    // ✅ EL BACKEND RECIBIRÁ LA DURACIÓN CORRECTA Y HARÁ LA COMPARACIÓN APROPIADA
    const taskResponse = await axios.post("/api/tasks/parallel", payload);
    const createdTask = taskResponse.data;

      setLoading(false);

      if (newCategoryCreated) {
        console.log(
          "🔄 Refrescando categorías porque se creó nueva categoría..."
        );
        try {
          await refreshTypes();
          console.log("✅ Categorías refrescadas exitosamente");
        } catch (refreshError) {
          console.error("❌ Error al refrescar categorías:", refreshError);
        }
      }

      // ✅ NUEVO: Invalidar cache de tareas de ClickUp
      console.log("🔄 Invalidating ClickUp tasks cache...");
      try {
        await queryClient.invalidateQueries({ 
          queryKey: taskKeys.clickup() 
        });
        console.log("✅ ClickUp tasks cache invalidated successfully");
      } catch (cacheError) {
        console.error("❌ Error invalidating ClickUp tasks cache:", cacheError);
      }

      const assignedUserNames =
        createdTask.assignees?.map((a: any) => a.user.name).join(", ") ??
        "somebody";

      const startDate = new Date(createdTask.startDate).toLocaleDateString(
        "es-PE",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      );
      const endDate = new Date(createdTask.deadline).toLocaleDateString(
        "es-PE",
        {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      );

      toast.success(
        <TaskCreatedToastContent
          assignedUserNames={assignedUserNames}
          startDate={startDate}
          endDate={endDate}
        />
      );

      setUserHasManuallyChanged(false);
      setIsTypingNewCategory(false);
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
    console.log("👤 Usuario cambió la selección manualmente:", selectedUserIds);
    setUserHasManuallyChanged(true);
    setSuggestionChanged(false);
    return selectedUserIds;
  };

  const applySuggestion = () => {
    if (suggestedAssignment) {
      console.log(
        `🤖 Aplicando sugerencia manualmente: ${suggestedAssignment.userId}`
      );
      setUserHasManuallyChanged(false);
      setSuggestionChanged(false);
    }
  };

  const handleDurationComplete = (duration: string) => {
    console.log(`⏰ Duration completed, triggering suggestion: ${duration}`);
    setTriggerSuggestion((prev) => prev + 1);
  };

  const handleDurationChange = (duration: string) => {
    console.log(`⚡ Duration changed in real-time: ${duration}`);
  };

  return (
    <aside className="bg-background sticky w-[28rem] p-10 h-dvh overflow-y-auto top-0 border-l border-l-white/10">
      <SpinnerCreatingTask isActive={loading} />
      <SpinnerSearching isActive={fetchingSuggestion} />
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        enableReinitialize={true}
      >
        {({ values, errors, touched, setFieldValue, isSubmitting }) => {
          const handleCategoryChange = (
            value: string | null,
            isNew?: boolean,
            newCategoryName?: string
          ) => {
            console.log(
              `📋 Category change: (value: ${value}, isNew: ${isNew}, newCategoryName: ${newCategoryName})`
            );

            // ✅ OPTIMIZADO: Aplicar todos los cambios de una vez usando batch
            const applyChanges = () => {
              setFieldValue("categoryId", value || "");
              setFieldValue("isNewCategory", isNew || false);
              setFieldValue("newCategoryName", newCategoryName || "");

              if (isNew) {
                // Para nueva categoría: limpiar duración, asignaciones y tier
                setFieldValue("durationDays", "");
                setFieldValue("assignedUserIds", []);
                setFieldValue("newCategoryTier", null);
                setSuggestedAssignment(null);

                // ✅ Si ya hay duración, triggear sugerencia después de limpiar
                if (values.durationDays && parseFloat(values.durationDays as string) > 0) {
                  setTimeout(() => {
                    console.log("🔄 Triggering suggestion for new category with existing duration");
                    setTriggerSuggestion((prev) => prev + 1);
                  }, 100);
                }
              } else {
                // Para categoría existente: solo limpiar asignaciones y tier
                setFieldValue("assignedUserIds", []);
                setFieldValue("newCategoryTier", null);
                setSuggestedAssignment(null);
              }

              // ✅ Resetear flags después de aplicar cambios
              setUserHasManuallyChanged(false);
              setSuggestionChanged(false);
            };

            // ✅ Aplicar cambios de forma asíncrona para evitar loops
            requestAnimationFrame(applyChanges);
          };

          // ✅ Calculate current typeId for UserAssignmentSelect
          const getCurrentTypeId = () => {
            if (values.isNewCategory) {
              const filteredTypes = types.filter((type) => {
                const typeKind = getTypeKind(type.name);
                return typeKind === selectedKind;
              });
              return filteredTypes.length > 0 ? filteredTypes[0].id : undefined;
            } else if (values.categoryId) {
              const selectedCategory = allCategories.find(
                (cat) => cat.id.toString() === values.categoryId
              );
              return selectedCategory?.typeId;
            }
            return undefined;
          };

          const currentTypeId = getCurrentTypeId();

          return (
            <Form className="flex flex-col gap-4">
              <FormikSuggestionLogic
                users={users}
                setSuggestedAssignment={setSuggestedAssignment}
                setFetchingSuggestion={setFetchingSuggestion}
                resetCategory={resetCategory}
                setResetCategory={setResetCategory}
                userHasManuallyChanged={userHasManuallyChanged}
                setUserHasManuallyChanged={setUserHasManuallyChanged}
                isNewCategory={values.isNewCategory}
                types={types}
                selectedKind={selectedKind}
                triggerSuggestion={triggerSuggestion}
                isSubmitting={isSubmitting}
                allCategories={allCategories}
                setSuggestionChanged={setSuggestionChanged}
              />

              <TaskKindSwitch
                selectedKind={selectedKind}
                onKindChange={(kind) => {
                  setSelectedKind(kind);
                  setTimeout(() => {
                    setFieldValue("categoryId", "");
                    setFieldValue("durationDays", "");
                    setFieldValue("assignedUserIds", []);
                    setFieldValue("isNewCategory", false);
                    setFieldValue("newCategoryName", "");
                    setFieldValue("newCategoryTier", null);
                    setSuggestedAssignment(null);
                    setUserHasManuallyChanged(false);
                    setIsTypingNewCategory(false);
                    setSuggestionChanged(false);
                  }, 0);
                }}
              />

              <TaskNameField touched={touched.name} error={errors.name} />

              <BrandSelect
                brands={brands}
                value={values.brandId}
                onChange={(value) => {
                  setFieldValue("brandId", value);
                  setTimeout(() => {
                    setFieldValue("assignedUserIds", []);
                    setSuggestedAssignment(null);
                    setUserHasManuallyChanged(false);
                    setSuggestionChanged(false);
                  }, 0);
                }}
                touched={touched.brandId}
                error={errors.brandId}
                loading={dataLoading}
              />

              <CategorySelect
                categories={allCategories}
                value={values.categoryId || null}
                onChange={handleCategoryChange}
                onCategoryChange={() => {
                  setTimeout(() => {
                    if (!values.isNewCategory) {
                      setFieldValue("assignedUserIds", []);
                      setSuggestedAssignment(null);
                    }
                    setUserHasManuallyChanged(false);
                    setSuggestionChanged(false);
                  }, 0);
                }}
                touched={touched.categoryId}
                error={errors.categoryId}
                loading={dataLoading}
                selectedTier={values.newCategoryTier}
                onTierChange={(tier) => setFieldValue("newCategoryTier", tier)}
                showTierSelection={values.isNewCategory}
                onTypingNewCategory={setIsTypingNewCategory}
                tierTouched={touched.newCategoryTier}
                tierError={errors.newCategoryTier}
              />

              <PrioritySelect
                value={values.priority}
                onChange={(value) => {
                  setFieldValue("priority", value);
                  if (!values.isNewCategory) {
                    setUserHasManuallyChanged(false);
                  }
                }}
                touched={touched.priority}
                error={errors.priority}
              />

              <DurationField
                fetchingSuggestion={fetchingSuggestion && !values.isNewCategory}
                touched={touched.durationDays}
                error={errors.durationDays}
                isTypingNewCategory={isTypingNewCategory}
                onDurationComplete={handleDurationComplete}
                onDurationChange={handleDurationChange}
                allCategories={allCategories}
                suggestionChanged={suggestionChanged}
                suggestedUser={suggestedUser}
              />

              <UserAssignmentSelect
                users={users}
                values={values.assignedUserIds}
                onChange={(selectedUserIds) => {
                  const newSelection =
                    handleUserSelectionChange(selectedUserIds);
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
                // ✅ NEW: Pass parameters for vacation-aware filtering
                typeId={currentTypeId}
                brandId={values.brandId || undefined}
                durationDays={
                  values.durationDays
                    ? parseFloat(values.durationDays as string)
                    : undefined
                }
                info={{ categoryId: values.categoryId, brandId: values.brandId }}
              />

              <Button
                type="submit"
                fullWidth
                disabled={
                  loading ||
                  isSubmitting ||
                  (brands.length === 0 && !dataLoading)
                }
                size="lg"
                sx={{ marginTop: "1rem" }}
              >
                {isSubmitting ? "Creating..." : "Create Task"}
              </Button>

              {brands.length === 0 && !dataLoading && (
                <Typography level="body-xs" color="warning" textAlign="center">
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