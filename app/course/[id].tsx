import { useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useAuth } from "@/lib/auth-context";
import { AppTextInput } from "@/components/app-text-input";
import { confirmAction } from "@/lib/confirm";
import {
  addAssessment,
  addScheme,
  type Assessment,
  type BundleItem,
  batchUpdateOrders,
  type Course,
  type CourseStatus,
  deleteAssessment,
  deleteCourse,
  initAssessmentOrder,
  type Scheme,
  subscribeToAssessments,
  subscribeToCourse,
  subscribeToSchemes,
  updateAssessment,
  updateCourse,
  updateScheme,
  deleteScheme,
} from "@/lib/firestore";

const COLORS = {
  bg: "#020617",
  card: "rgba(255, 255, 255, 0.05)",
  border: "rgba(255, 255, 255, 0.12)",
  accent: "#a78bfa",
  success: "#4ade80",
  danger: "#f87171",
  textMain: "#f8fafc",
  textDim: "#94a3b8",
  inputBg: "rgba(255, 255, 255, 0.08)",
};

function computeRepeatedGrade(a: Assessment): number | null {
  const items = a.items ?? [];
  const graded = items
    .filter((i) => i.grade !== null)
    .map((i) => i.grade as number);
  if (graded.length === 0) return null;
  const n = Math.min(a.countBest ?? graded.length, graded.length);
  const topN = [...graded].sort((x, y) => y - x).slice(0, n);
  return topN.reduce((s, g) => s + g, 0) / topN.length;
}

function computeGrade(assessments: Assessment[]): number | null {
  const graded = assessments.filter((a) => {
    if (!a.type || a.type === "single") return a.grade !== null;
    return (a.items ?? []).some((i) => i.grade !== null);
  });
  if (graded.length === 0) return null;
  const totalWeight = graded.reduce((sum, a) => sum + a.weight, 0);
  if (totalWeight === 0) return null;
  const weightedSum = graded.reduce((sum, a) => {
    if (!a.type || a.type === "single") {
      return sum + (a.grade as number) * a.weight;
    }
    const g = computeRepeatedGrade(a) ?? 0;
    return sum + g * a.weight;
  }, 0);
  return weightedSum / totalWeight;
}

const EMPTY_FORM = { name: "", weight: "", grade: "" };
const EMPTY_REPEATED_FORM = { name: "", weight: "", total: "", countBest: "" };

// ─── Animated assessment card ─────────────────────────────────────────────────

interface AssessmentCardProps {
  item: Assessment;
  flashKey: number;
  isDragging: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: (clientY: number, cardClientY: number) => void;
  onItemLayout: (height: number) => void;
}

function AssessmentCard({
  item,
  flashKey,
  isDragging,
  onEdit,
  onDelete,
  onDragStart,
  onItemLayout,
}: AssessmentCardProps) {
  const flashProgress = useSharedValue(0);
  const cardRef = useRef<any>(null);

  useEffect(() => {
    if (flashKey === 0) return;
    flashProgress.value = withSequence(
      withTiming(1, { duration: 180 }),
      withTiming(0, { duration: 520 }),
    );
  }, [flashKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      flashProgress.value,
      [0, 1],
      ["rgba(255,255,255,0.05)", "rgba(167,139,250,0.38)"],
    ),
  }));

  return (
    <View onLayout={(e) => onItemLayout(e.nativeEvent.layout.height)}>
      <Animated.View
        ref={cardRef}
        style={[
          styles.assessmentCard,
          animatedStyle,
          isDragging && styles.assessmentPlaceholder,
        ]}
      >
        {Platform.OS === "web" && (
          <View
            style={[styles.dragHandle, { cursor: "grab" } as any]}
            {...({
              onPointerDown: (e: any) => {
                e.preventDefault();
                e.stopPropagation();
                const rect = cardRef.current?.getBoundingClientRect?.();
                onDragStart(
                  e.nativeEvent?.clientY ?? e.clientY,
                  rect?.top ?? e.nativeEvent?.clientY ?? e.clientY,
                );
              },
            } as any)}
          >
            <Text style={styles.dragHandleText}>⠿</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.assessmentInner}
          onPress={onEdit}
          activeOpacity={0.7}
        >
          <View style={styles.assessmentLeft}>
            <Text style={styles.assessmentName}>{item.name}</Text>
            <Text style={styles.assessmentWeight}>Weight: {item.weight}%</Text>
          </View>
          <View style={styles.assessmentRight}>
            {item.grade !== null ? (
              <Text style={styles.assessmentGrade}>
                {item.grade.toFixed(1)}%
              </Text>
            ) : (
              <Text style={styles.assessmentPending}>—</Text>
            )}
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={onDelete}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Repeated assessment card ──────────────────────────────────────────────────

interface RepeatedAssessmentCardProps {
  item: Assessment;
  flashKey: number;
  isDragging: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart: (clientY: number, cardClientY: number) => void;
  onItemLayout: (height: number) => void;
  onUpdateItemGrade: (itemIdx: number, gradeStr: string) => void;
  stickyTop: number;
}

function RepeatedAssessmentCard({
  item,
  flashKey,
  isDragging,
  onEdit,
  onDelete,
  onDragStart,
  onItemLayout,
  onUpdateItemGrade,
  stickyTop,
}: RepeatedAssessmentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const localGradesRef = useRef<string[]>(
    (item.items ?? []).map((i) => (i.grade !== null ? String(i.grade) : "")),
  );
  const [localGrades, setLocalGrades] = useState<string[]>(
    () => localGradesRef.current,
  );

  useEffect(() => {
    const synced = (item.items ?? []).map((i) =>
      i.grade !== null ? String(i.grade) : "",
    );
    localGradesRef.current = synced;
    setLocalGrades(synced);
  }, [item.items]);

  const flashProgress = useSharedValue(0);
  const cardRef = useRef<any>(null);

  useEffect(() => {
    if (flashKey === 0) return;
    flashProgress.value = withSequence(
      withTiming(1, { duration: 180 }),
      withTiming(0, { duration: 520 }),
    );
  }, [flashKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      flashProgress.value,
      [0, 1],
      ["rgba(255,255,255,0.05)", "rgba(167,139,250,0.38)"],
    ),
  }));

  const repeatedGrade = computeRepeatedGrade(item);
  const gradedCount = (item.items ?? []).filter((i) => i.grade !== null).length;
  const totalItems = item.items?.length ?? 0;

  return (
    <View onLayout={(e) => onItemLayout(e.nativeEvent.layout.height)}>
      <View
        style={
          Platform.OS === "web" && expanded
            ? {
                position: "sticky" as any,
                top: stickyTop,
                zIndex: 10,
                backgroundColor: COLORS.bg,
              }
            : undefined
        }
      >
        <Animated.View
          ref={cardRef}
          style={[
            styles.assessmentCard,
            animatedStyle,
            isDragging && styles.assessmentPlaceholder,
          ]}
        >
          {Platform.OS === "web" && (
            <View
              style={[styles.dragHandle, { cursor: "grab" } as any]}
              {...({
                onPointerDown: (e: any) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = cardRef.current?.getBoundingClientRect?.();
                  onDragStart(
                    e.nativeEvent?.clientY ?? e.clientY,
                    rect?.top ?? e.nativeEvent?.clientY ?? e.clientY,
                  );
                },
              } as any)}
            >
              <Text style={styles.dragHandleText}>⠿</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.assessmentInner}
            onPress={() => setExpanded((e) => !e)}
            activeOpacity={0.7}
          >
            <View style={styles.assessmentLeft}>
              <Text style={styles.assessmentName}>{item.name}</Text>
              <Text style={styles.assessmentWeight}>
                Weight: {item.weight}% · Top {item.countBest} of {totalItems} ·{" "}
                {gradedCount}/{totalItems} graded
              </Text>
            </View>
            <View style={styles.assessmentRight}>
              <Text style={styles.repeatedChevron}>{expanded ? "▲" : "▼"}</Text>
              {repeatedGrade !== null ? (
                <Text style={styles.assessmentGrade}>
                  {repeatedGrade.toFixed(1)}%
                </Text>
              ) : (
                <Text style={styles.assessmentPending}>—</Text>
              )}
              <TouchableOpacity
                style={styles.editRepeatedBtn}
                onPress={onEdit}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.editRepeatedBtnText}>✎</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={onDelete}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>
      {expanded && (
        <View style={styles.repeatedItemsWrapper}>
          {(item.items ?? []).map((bi, idx) => (
            <View key={bi.id} style={styles.repeatedItemRow}>
              <Text style={styles.repeatedItemLabel}>Item {idx + 1}</Text>
              <AppTextInput
                style={styles.repeatedItemInput}
                placeholder="—"
                placeholderTextColor={COLORS.textDim}
                keyboardType="decimal-pad"
                value={localGrades[idx] ?? ""}
                onChangeText={(v) => {
                  const next = [...localGradesRef.current];
                  next[idx] = v;
                  localGradesRef.current = next;
                  setLocalGrades([...next]);
                }}
                onBlur={() =>
                  onUpdateItemGrade(idx, localGradesRef.current[idx] ?? "")
                }
              />
              <Text style={styles.repeatedItemPercent}>%</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function CourseDetailScreen() {
  const {
    id,
    name,
    status: initialStatus,
  } = useLocalSearchParams<{
    id: string;
    name: string;
    status: CourseStatus;
  }>();
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid ?? "";

  // Seed display values from URL params immediately so there's no blank flash
  // on navigation, then override with authoritative Firestore values once loaded.
  const [courseName, setCourseName] = useState(name ?? "Course");
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseStatus, setCourseStatus] = useState<CourseStatus>(
    (initialStatus as CourseStatus) ?? "active",
  );
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [activeSchemeIdx, setActiveSchemeIdx] = useState(0);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const deletingRef = useRef(false);
  const [flashKeys, setFlashKeys] = useState<Record<string, number>>({});

  const [repeatedModalVisible, setRepeatedModalVisible] = useState(false);
  const [editingRepeatedId, setEditingRepeatedId] = useState<string | null>(
    null,
  );
  const [repeatedForm, setRepeatedForm] = useState(EMPTY_REPEATED_FORM);
  const [repeatedSaving, setRepeatedSaving] = useState(false);
  const [summaryHeight, setSummaryHeight] = useState(0);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [dropdownTop, setDropdownTop] = useState(56);
  const addButtonRef = useRef<any>(null);
  const { width: screenWidth } = useWindowDimensions();
  const dropdownRight = Math.max(20, (screenWidth - 900) / 2 + 20);

  // ─── Drag-and-drop state ─────────────────────────────────────────────────────
  const [dragIdx, setDragIdx] = useState(-1);
  const [hoverIdx, setHoverIdx] = useState(-1);
  const [ghostTop, setGhostTop] = useState(0);
  const dragIdxRef = useRef(-1);
  const hoverIdxRef = useRef(-1);
  const itemHeightsRef = useRef<number[]>([]);
  const listTopRef = useRef(0);
  const listScrollRef = useRef(0);
  const dragScrollStartRef = useRef(0);
  const listViewRef = useRef<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const scoreInputRef = useRef<any>(null);
  const [gradeInputFocused, setGradeInputFocused] = useState(false);

  useEffect(() => {
    if (!id || !uid) return;
    return subscribeToCourse(uid, id, (course: Course | null) => {
      if (!course) {
        // Course doesn't exist or doesn't belong to this user — redirect away
        router.replace("/(tabs)/courses" as any);
        return;
      }
      setCourseName(course.name);
      setCourseStatus(course.status);
    });
  }, [id, uid]);

  useEffect(() => {
    if (!id || !uid) return;
    const unsubscribe = subscribeToAssessments(uid, id, (data) => {
      setAssessments(data);
      setLoading(false);
      initAssessmentOrder(uid, id, data).catch(() => {});
    });
    return unsubscribe;
  }, [id, uid]);

  useEffect(() => {
    if (!id || !uid) return;
    return subscribeToSchemes(uid, id, setSchemes);
  }, [id, uid]);

  // Clamp active scheme index when the schemes list shrinks
  useEffect(() => {
    if (schemes.length > 0 && activeSchemeIdx >= schemes.length) {
      setActiveSchemeIdx(schemes.length - 1);
    }
  }, [schemes.length, activeSchemeIdx]);

  // Keep the course's computed grade in sync (uses best scheme when multi-scheme)
  useEffect(() => {
    if (!id || !uid || loading || deletingRef.current) return;
    let grade: number | null;
    if (schemes.length >= 2) {
      grade = schemes.reduce<number | null>((best, scheme) => {
        const sa = assessments.map((a) => ({
          ...a,
          weight: scheme.weights[a.id] ?? a.weight,
        }));
        const g = computeGrade(sa);
        return g !== null && (best === null || g > best) ? g : best;
      }, null);
    } else {
      grade = computeGrade(assessments);
    }
    if (grade === null) return;
    updateCourse(uid, id, { grade }).catch(() => {});
  }, [assessments, schemes, id, uid, loading]);

  const handleDeleteCourse = async () => {
    const confirmed = await confirmAction(
      "Delete Course",
      `Remove "${courseName}" and all its assessments? This cannot be undone.`,
    );
    if (!confirmed) return;
    deletingRef.current = true;
    try {
      await deleteCourse(uid, id!);
      router.replace("/(tabs)/courses" as any);
    } catch (e) {
      deletingRef.current = false;
      Alert.alert("Error", "Failed to delete course. Please try again.");
    }
  };

  const handleStatusChange = async (newStatus: CourseStatus) => {
    if (newStatus === courseStatus) return;
    setCourseStatus(newStatus);
    try {
      await updateCourse(uid, id!, { status: newStatus });
    } catch (e) {
      setCourseStatus(courseStatus);
      Alert.alert("Error", "Failed to update course status.");
    }
  };

  useEffect(() => {
    if (modalVisible && editingId) {
      const timer = setTimeout(() => scoreInputRef.current?.focus(), 300);
      return () => clearTimeout(timer);
    }
  }, [modalVisible, editingId]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalVisible(true);
  };

  const openEdit = (assessment: Assessment) => {
    const activeScheme =
      schemes.length > 0 ? (schemes[activeSchemeIdx] ?? null) : null;
    const schemeWeight =
      activeScheme != null
        ? (activeScheme.weights[assessment.id] ?? assessment.weight)
        : assessment.weight;
    setEditingId(assessment.id);
    setForm({
      name: assessment.name,
      weight: String(schemeWeight),
      grade: assessment.grade !== null ? String(assessment.grade) : "",
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      Alert.alert("Validation", "Please enter a name for the assessment.");
      return;
    }
    const weight = parseFloat(form.weight);
    if (isNaN(weight) || weight < 0 || weight > 100) {
      Alert.alert("Validation", "Weight must be a number between 0 and 100.");
      return;
    }
    let grade: number | null = null;
    if (form.grade.trim() !== "") {
      grade = parseFloat(form.grade);
      if (isNaN(grade) || grade < 0 || grade > 100) {
        Alert.alert("Validation", "Grade must be a number between 0 and 100.");
        return;
      }
    }

    const activeScheme =
      schemes.length > 0 ? (schemes[activeSchemeIdx] ?? null) : null;
    setSaving(true);
    try {
      if (editingId) {
        if (activeScheme != null) {
          await updateAssessment(uid, id!, editingId, {
            name: trimmedName,
            grade,
          });
          await updateScheme(uid, id!, activeScheme.id, {
            weights: { ...activeScheme.weights, [editingId]: weight },
          });
        } else {
          await updateAssessment(uid, id!, editingId, {
            name: trimmedName,
            weight,
            grade,
          });
        }
      } else {
        if (assessments.length >= 50) {
          Alert.alert(
            "Limit Reached",
            "You can have at most 50 assessments per course.",
          );
          setSaving(false);
          return;
        }
        const newId = await addAssessment(uid, id!, {
          name: trimmedName,
          weight,
          grade,
          order: assessments.length,
        });
        if (schemes.length > 0) {
          await Promise.all(
            schemes.map((s) =>
              updateScheme(uid, id!, s.id, {
                weights: { ...s.weights, [newId]: weight },
              }),
            ),
          );
        }
      }
      setModalVisible(false);
    } catch (e) {
      Alert.alert("Error", "Failed to save assessment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (assessment: Assessment) => {
    const confirmed = await confirmAction(
      "Delete Assessment",
      `Remove "${assessment.name}" from this course?`,
    );
    if (!confirmed) return;
    try {
      await deleteAssessment(uid, id!, assessment.id);
      if (schemes.length > 0) {
        await Promise.all(
          schemes.map((s) => {
            const newWeights = { ...s.weights };
            delete newWeights[assessment.id];
            return updateScheme(uid, id!, s.id, { weights: newWeights });
          }),
        );
      }
    } catch {
      Alert.alert("Error", "Failed to delete assessment.");
    }
  };

  const openAddRepeated = () => {
    setEditingRepeatedId(null);
    setRepeatedForm(EMPTY_REPEATED_FORM);
    setRepeatedModalVisible(true);
  };

  const handleDeleteScheme = async (scheme: Scheme) => {
    const confirmed = await confirmAction(
      "Delete Scheme",
      `Remove "${scheme.name}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await deleteScheme(uid, id!, scheme.id);
    } catch {
      Alert.alert("Error", "Failed to delete scheme. Please try again.");
    }
  };

  const handleAddScheme = async () => {
    try {
      if (schemes.length === 0) {
        // First add: formalise current weights as Scheme 1 and create Scheme 2
        const baseWeights: Record<string, number> = {};
        assessments.forEach((a) => {
          baseWeights[a.id] = a.weight;
        });
        await Promise.all([
          addScheme(uid, id!, {
            name: "Scheme 1",
            order: 0,
            weights: { ...baseWeights },
          }),
          addScheme(uid, id!, {
            name: "Scheme 2",
            order: 1,
            weights: { ...baseWeights },
          }),
        ]);
        setActiveSchemeIdx(1);
      } else {
        const src = schemes[activeSchemeIdx] ?? schemes[schemes.length - 1];
        await addScheme(uid, id!, {
          name: `Scheme ${schemes.length + 1}`,
          order: schemes.length,
          weights: { ...(src?.weights ?? {}) },
        });
        setActiveSchemeIdx(schemes.length);
      }
    } catch {
      Alert.alert("Error", "Failed to add scheme. Please try again.");
    }
  };

  const openEditRepeated = (a: Assessment) => {
    const activeScheme =
      schemes.length > 0 ? (schemes[activeSchemeIdx] ?? null) : null;
    const schemeWeight =
      activeScheme != null
        ? (activeScheme.weights[a.id] ?? a.weight)
        : a.weight;
    setEditingRepeatedId(a.id);
    const itemCount = a.items?.length ?? 0;
    setRepeatedForm({
      name: a.name,
      weight: String(schemeWeight),
      total: String(itemCount),
      countBest: String(itemCount - (a.countBest ?? itemCount)),
    });
    setRepeatedModalVisible(true);
  };

  const handleSaveRepeated = async () => {
    const trimmedName = repeatedForm.name.trim();
    if (!trimmedName) {
      Alert.alert("Validation", "Please enter a name.");
      return;
    }
    const weight = parseFloat(repeatedForm.weight);
    if (isNaN(weight) || weight < 0 || weight > 100) {
      Alert.alert("Validation", "Weight must be a number between 0 and 100.");
      return;
    }
    const total = parseInt(repeatedForm.total, 10);
    if (isNaN(total) || total < 1) {
      Alert.alert("Validation", "Total items must be at least 1.");
      return;
    }
    const dropped = parseInt(repeatedForm.countBest, 10);
    if (isNaN(dropped) || dropped < 0 || dropped >= total) {
      Alert.alert(
        "Validation",
        dropped >= total
          ? `Cannot drop all ${total} items. Enter a value between 0 and ${total - 1}.`
          : "How Many Dropped cannot be negative.",
      );
      return;
    }
    const countBest = total - dropped;
    const activeScheme =
      schemes.length > 0 ? (schemes[activeSchemeIdx] ?? null) : null;
    setRepeatedSaving(true);
    try {
      if (!editingRepeatedId && assessments.length >= 50) {
        Alert.alert(
          "Limit Reached",
          "You can have at most 50 assessments per course.",
        );
        setRepeatedSaving(false);
        return;
      }
      if (editingRepeatedId) {
        const existing = assessments.find((a) => a.id === editingRepeatedId);
        const existingItems: BundleItem[] = existing?.items ?? [];
        let newItems: BundleItem[];
        if (total > existingItems.length) {
          newItems = [
            ...existingItems,
            ...Array.from({ length: total - existingItems.length }, (_, i) => ({
              id: String(existingItems.length + i),
              grade: null as null,
            })),
          ];
        } else {
          newItems = existingItems.slice(0, total);
        }
        if (activeScheme != null) {
          await updateAssessment(uid, id!, editingRepeatedId, {
            name: trimmedName,
            countBest,
            items: newItems,
          });
          await updateScheme(uid, id!, activeScheme.id, {
            weights: { ...activeScheme.weights, [editingRepeatedId]: weight },
          });
        } else {
          await updateAssessment(uid, id!, editingRepeatedId, {
            name: trimmedName,
            weight,
            countBest,
            items: newItems,
          });
        }
      } else {
        const items: BundleItem[] = Array.from({ length: total }, (_, i) => ({
          id: String(i),
          grade: null as null,
        }));
        const newId = await addAssessment(uid, id!, {
          name: trimmedName,
          weight,
          grade: null,
          order: assessments.length,
          type: "bundle",
          countBest,
          items,
        });
        if (schemes.length > 0) {
          await Promise.all(
            schemes.map((s) =>
              updateScheme(uid, id!, s.id, {
                weights: { ...s.weights, [newId]: weight },
              }),
            ),
          );
        }
      }
      setRepeatedModalVisible(false);
    } catch {
      Alert.alert("Error", "Failed to save. Please try again.");
    } finally {
      setRepeatedSaving(false);
    }
  };

  const handleUpdateRepeatedItemGrade = async (
    bundleId: string,
    itemIdx: number,
    gradeStr: string,
  ) => {
    const bundle = assessments.find((a) => a.id === bundleId);
    if (!bundle?.items) return;
    const parsed = gradeStr.trim() === "" ? null : parseFloat(gradeStr);
    if (parsed !== null && (isNaN(parsed) || parsed < -50 || parsed > 150))
      return;
    const newItems = bundle.items.map((item, i) =>
      i === itemIdx ? { ...item, grade: parsed } : item,
    );
    try {
      await updateAssessment(uid, id!, bundleId, { items: newItems });
    } catch {
      Alert.alert("Error", "Failed to save grade.");
    }
  };

  const [desiredGrade, setDesiredGrade] = useState("");
  const [desiredGradeOpen, setDesiredGradeOpen] = useState(false);
  const [weightWarningDismissed, setWeightWarningDismissed] = useState(false);

  const activeScheme =
    schemes.length > 0 ? (schemes[activeSchemeIdx] ?? null) : null;

  const effectiveAssessments = useMemo(
    () =>
      assessments.map((a) => ({
        ...a,
        weight:
          activeScheme != null
            ? (activeScheme.weights[a.id] ?? a.weight)
            : a.weight,
      })),
    [assessments, activeScheme],
  );

  const schemeGrades = useMemo(
    () =>
      schemes.map((scheme) => {
        const sa = assessments.map((a) => ({
          ...a,
          weight: scheme.weights[a.id] ?? a.weight,
        }));
        return computeGrade(sa);
      }),
    [schemes, assessments],
  );

  const bestSchemeIdx = useMemo(() => {
    let bestIdx = -1;
    let bestGrade = -Infinity;
    schemeGrades.forEach((g, i) => {
      if (g !== null && g > bestGrade) {
        bestGrade = g;
        bestIdx = i;
      }
    });
    return bestIdx;
  }, [schemeGrades]);

  const calculatedGrade = computeGrade(effectiveAssessments);
  const totalWeight = effectiveAssessments.reduce(
    (sum, a) => sum + a.weight,
    0,
  );
  const gradedWeight = effectiveAssessments
    .filter((a) => {
      if (!a.type || a.type === "single") return a.grade !== null;
      return (a.items ?? []).some((i) => i.grade !== null);
    })
    .reduce((sum, a) => sum + a.weight, 0);

  // Re-show the warning whenever the total weight changes
  useEffect(() => {
    setWeightWarningDismissed(false);
  }, [totalWeight]);

  // ─── Desired final grade calculation ────────────────────────────────────────
  const requiredScore = useMemo((): number | null => {
    const desired = parseFloat(desiredGrade);
    if (isNaN(desired) || desired < 0 || desired > 100) return null;
    const gw = effectiveAssessments
      .filter((a) => {
        if (!a.type || a.type === "single") return a.grade !== null;
        return (a.items ?? []).some((i) => i.grade !== null);
      })
      .reduce((sum, a) => sum + a.weight, 0);
    const remainingWeight = 100 - gw;
    if (remainingWeight <= 0) return null;
    const currentWeightedSum = effectiveAssessments.reduce((sum, a) => {
      if (!a.type || a.type === "single") {
        return a.grade !== null ? sum + (a.grade as number) * a.weight : sum;
      }
      const g = computeRepeatedGrade(a);
      return g !== null ? sum + g * a.weight : sum;
    }, 0);
    return (desired * 100 - currentWeightedSum) / remainingWeight;
  }, [desiredGrade, effectiveAssessments]);

  // ─── Drag helpers ─────────────────────────────────────────────────────────────

  const displayAssessments = useMemo(() => {
    let arr: Assessment[];
    if (dragIdx === -1 || hoverIdx === -1 || hoverIdx === dragIdx) {
      arr = assessments;
    } else {
      arr = [...assessments];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(hoverIdx, 0, moved);
    }
    return arr.map((a) => ({
      ...a,
      weight:
        activeScheme != null
          ? (activeScheme.weights[a.id] ?? a.weight)
          : a.weight,
    }));
  }, [assessments, dragIdx, hoverIdx, activeScheme]);

  const handleDragStart = useCallback(
    (index: number, clientY: number, cardTop: number) => {
      if (Platform.OS !== "web") return;
      const doc = typeof document !== "undefined" ? document : null;
      if (!doc) return;

      const offset = clientY - cardTop;
      const listRect = listViewRef.current?.getBoundingClientRect?.();
      dragScrollStartRef.current = listScrollRef.current;
      listTopRef.current = listRect?.top ?? 0;

      dragIdxRef.current = index;
      hoverIdxRef.current = index;
      setDragIdx(index);
      setHoverIdx(index);
      setGhostTop(clientY - offset);

      const itemCount = assessments.length;
      const MARGIN = 10;

      const computeHover = (y: number): number => {
        const relY =
          y -
          listTopRef.current +
          (listScrollRef.current - dragScrollStartRef.current);
        let accY = 0;
        for (let i = 0; i < itemCount; i++) {
          const h = itemHeightsRef.current[i] ?? 66;
          if (relY < accY + h / 2) return i;
          accY += h + MARGIN;
        }
        return itemCount - 1;
      };

      const commit = async (from: number, to: number) => {
        const arr = [...assessments];
        const [moved] = arr.splice(from, 1);
        arr.splice(to, 0, moved);
        try {
          await batchUpdateOrders(
            uid,
            id!,
            arr.map((a, i) => ({ id: a.id, order: i })),
          );
        } catch {
          Alert.alert("Error", "Failed to reorder assessments.");
        }
      };

      const onMove = (e: Event) => {
        const pe = e as PointerEvent;
        setGhostTop(pe.clientY - offset);
        const newHover = computeHover(pe.clientY);
        if (newHover !== hoverIdxRef.current) {
          hoverIdxRef.current = newHover;
          setHoverIdx(newHover);
        }
      };

      const onUp = () => {
        doc.removeEventListener("pointermove", onMove);
        doc.removeEventListener("pointerup", onUp);
        const from = dragIdxRef.current;
        const to = hoverIdxRef.current;
        dragIdxRef.current = -1;
        hoverIdxRef.current = -1;
        setDragIdx(-1);
        setHoverIdx(-1);
        if (from !== -1 && to !== -1 && from !== to) {
          commit(from, to);
        }
      };

      doc.addEventListener("pointermove", onMove);
      doc.addEventListener("pointerup", onUp);
    },
    [assessments, id, uid],
  );

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        stickyHeaderIndices={Platform.OS !== "web" ? [1] : undefined}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(e) => {
          listScrollRef.current = e.nativeEvent.contentOffset.y;
        }}
      >
        {/* [0] Course header — scrolls away */}
        <View style={styles.headerWrapper}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backBtn}
            >
              <Text style={styles.backBtnText}>‹ Back</Text>
            </TouchableOpacity>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.deleteCourseBtnHeader}
                onPress={handleDeleteCourse}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.deleteCourseText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                ref={addButtonRef}
                style={styles.addButton}
                onPress={() => {
                  if (addButtonRef.current?.measure) {
                    addButtonRef.current.measure(
                      (
                        _x: number,
                        _y: number,
                        _w: number,
                        h: number,
                        _px: number,
                        py: number,
                      ) => {
                        setDropdownTop(py + h + 6);
                      },
                    );
                  }
                  setAddMenuOpen((o) => !o);
                }}
              >
                <Text style={styles.addButtonText}>+ Add ▾</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.courseName}>{courseName}</Text>

          {/* Status selector */}
          <View style={styles.statusRow}>
            {(["active", "completed", "planned"] as CourseStatus[]).map((s) => (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusChip,
                  courseStatus === s && styles.statusChipActive,
                  courseStatus === s &&
                    s === "active" && {
                      borderColor: COLORS.success,
                      backgroundColor: "rgba(74, 222, 128, 0.15)",
                    },
                  courseStatus === s &&
                    s === "completed" && {
                      borderColor: COLORS.accent,
                      backgroundColor: "rgba(167, 139, 250, 0.15)",
                    },
                  courseStatus === s &&
                    s === "planned" && {
                      borderColor: COLORS.textDim,
                      backgroundColor: "rgba(148, 163, 184, 0.15)",
                    },
                ]}
                onPress={() => handleStatusChange(s)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    courseStatus === s &&
                      s === "active" && { color: COLORS.success },
                    courseStatus === s &&
                      s === "completed" && { color: COLORS.accent },
                    courseStatus === s &&
                      s === "planned" && { color: COLORS.textDim },
                  ]}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Desired final grade */}
          {courseStatus === "active" && (
            <View style={styles.desiredCard}>
              <TouchableOpacity
                style={styles.desiredTitleRow}
                onPress={() => setDesiredGradeOpen((o) => !o)}
                activeOpacity={0.7}
              >
                <Text style={styles.desiredTitle}>Desired Final Grade</Text>
                <Text style={styles.desiredChevron}>
                  {desiredGradeOpen ? "▲" : "▼"}
                </Text>
              </TouchableOpacity>
              {desiredGradeOpen && (
                <View style={styles.desiredRow}>
                  <AppTextInput
                    style={styles.desiredInput}
                    placeholder="e.g. 85"
                    placeholderTextColor={COLORS.textDim}
                    keyboardType="decimal-pad"
                    value={desiredGrade}
                    onChangeText={setDesiredGrade}
                    maxLength={6}
                  />
                  <Text style={styles.desiredPercent}>%</Text>
                  <View style={styles.desiredResultBox}>
                    {desiredGrade.trim() === "" ? (
                      <Text style={styles.desiredHint}>
                        Enter a target grade
                      </Text>
                    ) : requiredScore === null ? (
                      gradedWeight >= 100 ? (
                        <Text style={styles.desiredHint}>
                          All assessments graded.
                        </Text>
                      ) : (
                        <Text style={styles.desiredHint}>Invalid target</Text>
                      )
                    ) : (
                      <View style={styles.desiredResultInner}>
                        <Text style={styles.desiredResultLabel}>
                          Need on remaining
                        </Text>
                        <Text
                          style={[
                            styles.desiredResultValue,
                            {
                              color:
                                requiredScore > 100
                                  ? COLORS.danger
                                  : requiredScore < 0
                                    ? COLORS.textDim
                                    : COLORS.success,
                            },
                          ]}
                        >
                          {requiredScore < 0
                            ? "Already achieved"
                            : requiredScore > 100
                              ? `${requiredScore.toFixed(1)}% (not possible)`
                              : `${requiredScore.toFixed(1)}%`}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}

          <Text style={styles.subtitle}>Assessment Components</Text>
        </View>

        {/* [1] Grade summary — sticky */}
        <View
          style={[
            styles.summarySticky,
            Platform.OS === "web" && {
              position: "sticky" as any,
              top: 0,
              zIndex: 20,
            },
          ]}
          onLayout={(e) => setSummaryHeight(e.nativeEvent.layout.height)}
        >
          <View style={styles.summaryMaxWidth}>
            {/* Grade summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Calculated Grade</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    {
                      color:
                        calculatedGrade === null
                          ? COLORS.textDim
                          : calculatedGrade < 50
                            ? COLORS.danger
                            : calculatedGrade < 80
                              ? "#facc15"
                              : COLORS.success,
                    },
                  ]}
                >
                  {calculatedGrade !== null
                    ? `${calculatedGrade.toFixed(1)}%`
                    : "No grades yet"}
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Graded Weight</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    {
                      color:
                        gradedWeight === totalWeight
                          ? COLORS.success
                          : COLORS.accent,
                    },
                  ]}
                >
                  {gradedWeight}%
                </Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Weight</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    {
                      color:
                        totalWeight === 100 ? COLORS.success : COLORS.danger,
                    },
                  ]}
                >
                  {totalWeight}%
                </Text>
              </View>
            </View>

            {totalWeight !== 100 &&
              assessments.length > 0 &&
              !weightWarningDismissed && (
                <View style={styles.weightWarning}>
                  <Text style={styles.weightWarningText}>
                    ⚠ Your assessment weights add up to {totalWeight}%, not
                    100%.{" "}
                    {totalWeight < 100
                      ? `Add more components until they add up to 100%.`
                      : `Remove or reduce components so they add up to 100%.`}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setWeightWarningDismissed(true)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.weightWarningClose}
                  >
                    <Text style={styles.weightWarningCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
            {/* Scheme tabs — only shown when 2+ schemes exist */}
            {schemes.length >= 2 && (
              <View style={styles.schemeTabs}>
                {schemes.map((scheme, idx) => (
                  <View
                    key={scheme.id}
                    style={[
                      styles.schemeTab,
                      activeSchemeIdx === idx && styles.schemeTabActive,
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => setActiveSchemeIdx(idx)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.schemeTabText,
                          activeSchemeIdx === idx && styles.schemeTabTextActive,
                        ]}
                      >
                        {idx === bestSchemeIdx && schemeGrades[idx] !== null
                          ? "★ "
                          : ""}
                        {scheme.name}
                      </Text>
                    </TouchableOpacity>
                    {activeSchemeIdx === idx && (
                      <TouchableOpacity
                        onPress={() => handleDeleteScheme(scheme)}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        style={styles.schemeTabDelete}
                      >
                        <Text
                          style={[
                            styles.schemeTabDeleteText,
                            styles.schemeTabDeleteTextActive,
                          ]}
                        >
                          ✕
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* [2] Assessments list */}
        <View ref={listViewRef}>
          <View style={styles.maxWidthContent}>
            {displayAssessments.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>📝</Text>
                <Text style={styles.emptyTitle}>No Assessments Yet</Text>
                <Text style={styles.emptyText}>
                  Tap "+ Add" to add your first assessment component.
                </Text>
              </View>
            ) : (
              displayAssessments.map((item, displayIndex) => {
                const assessmentIndex = assessments.findIndex(
                  (a) => a.id === item.id,
                );
                const isDragging =
                  dragIdx !== -1 && item.id === assessments[dragIdx]?.id;
                if (item.type === "bundle") {
                  return (
                    <RepeatedAssessmentCard
                      key={item.id}
                      item={item}
                      flashKey={flashKeys[item.id] ?? 0}
                      isDragging={isDragging}
                      onEdit={() => openEditRepeated(item)}
                      onDelete={() => handleDelete(item)}
                      onDragStart={(clientY, cardTop) =>
                        handleDragStart(assessmentIndex, clientY, cardTop)
                      }
                      onItemLayout={(height) => {
                        itemHeightsRef.current[assessmentIndex] = height;
                      }}
                      onUpdateItemGrade={(itemIdx, grade) =>
                        handleUpdateRepeatedItemGrade(item.id, itemIdx, grade)
                      }
                      stickyTop={summaryHeight}
                    />
                  );
                }
                return (
                  <AssessmentCard
                    key={item.id}
                    item={item}
                    flashKey={flashKeys[item.id] ?? 0}
                    isDragging={isDragging}
                    onEdit={() => openEdit(item)}
                    onDelete={() => handleDelete(item)}
                    onDragStart={(clientY, cardTop) =>
                      handleDragStart(assessmentIndex, clientY, cardTop)
                    }
                    onItemLayout={(height) => {
                      itemHeightsRef.current[assessmentIndex] = height;
                    }}
                  />
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      {/* Add / Edit Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingId ? "Edit Assessment" : "Add Assessment"}
            </Text>

            <Text style={styles.fieldLabel}>Name</Text>
            <AppTextInput
              style={styles.input}
              placeholder="e.g. Midterm Exam"
              placeholderTextColor={COLORS.textDim}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <Text style={styles.fieldLabel}>Weight (%)</Text>
            <AppTextInput
              style={styles.input}
              placeholder="e.g. 30"
              placeholderTextColor={COLORS.textDim}
              keyboardType="decimal-pad"
              value={form.weight}
              onChangeText={(v) => setForm((f) => ({ ...f, weight: v }))}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <Text style={styles.fieldLabel}>
              Grade (%) — leave blank if not graded
            </Text>
            <TextInput
              ref={scoreInputRef}
              style={styles.input}
              placeholder={gradeInputFocused ? "" : "e.g. 85"}
              placeholderTextColor={COLORS.textDim}
              keyboardType="decimal-pad"
              value={form.grade}
              onChangeText={(v) => setForm((f) => ({ ...f, grade: v }))}
              onFocus={() => setGradeInputFocused(true)}
              onBlur={() => setGradeInputFocused(false)}
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Add"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add / Edit Repeated Assessment Modal */}
      <Modal
        visible={repeatedModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRepeatedModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingRepeatedId
                ? "Edit Repeated Assessment"
                : "Add Repeated Assessment"}
            </Text>

            <Text style={styles.fieldLabel}>Name</Text>
            <AppTextInput
              style={styles.input}
              placeholder="e.g. Weekly Quizzes"
              placeholderTextColor={COLORS.textDim}
              value={repeatedForm.name}
              onChangeText={(v) => setRepeatedForm((f) => ({ ...f, name: v }))}
              maxLength={30}
              returnKeyType="next"
            />

            <Text style={styles.fieldLabel}>Total Weight (%)</Text>
            <AppTextInput
              style={styles.input}
              placeholder="e.g. 20"
              placeholderTextColor={COLORS.textDim}
              keyboardType="decimal-pad"
              value={repeatedForm.weight}
              onChangeText={(v) =>
                setRepeatedForm((f) => ({ ...f, weight: v }))
              }
              returnKeyType="next"
            />

            <Text style={styles.fieldLabel}>Total Items</Text>
            <AppTextInput
              style={styles.input}
              placeholder="e.g. 12"
              placeholderTextColor={COLORS.textDim}
              keyboardType="number-pad"
              value={repeatedForm.total}
              onChangeText={(v) => setRepeatedForm((f) => ({ ...f, total: v }))}
              returnKeyType="next"
            />
            <Text style={styles.fieldLabel}>How Many Dropped</Text>
            <AppTextInput
              style={styles.input}
              placeholder="e.g. 2"
              placeholderTextColor={COLORS.textDim}
              keyboardType="number-pad"
              value={repeatedForm.countBest}
              onChangeText={(v) =>
                setRepeatedForm((f) => ({ ...f, countBest: v }))
              }
              returnKeyType="done"
              onSubmitEditing={handleSaveRepeated}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setRepeatedModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveRepeated}
                disabled={repeatedSaving}
              >
                <Text style={styles.saveBtnText}>
                  {repeatedSaving
                    ? "Saving..."
                    : editingRepeatedId
                      ? "Save Changes"
                      : "Add"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add assessment dropdown */}
      <Modal
        visible={addMenuOpen}
        transparent
        animationType="none"
        onRequestClose={() => setAddMenuOpen(false)}
      >
        <View style={StyleSheet.absoluteFillObject}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={() => setAddMenuOpen(false)}
            activeOpacity={1}
          />
          <View
            style={[
              styles.addDropdown,
              { right: dropdownRight, top: dropdownTop },
            ]}
          >
            <TouchableOpacity
              style={styles.addDropdownItem}
              onPress={() => {
                setAddMenuOpen(false);
                openAdd();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.addDropdownItemText}>
                Add Single Assessment
              </Text>
            </TouchableOpacity>
            <View style={styles.addDropdownDivider} />
            <TouchableOpacity
              style={styles.addDropdownItem}
              onPress={() => {
                setAddMenuOpen(false);
                openAddRepeated();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.addDropdownItemText}>
                Add Repeating Assessment
              </Text>
            </TouchableOpacity>
            <View style={styles.addDropdownDivider} />
            <TouchableOpacity
              style={styles.addDropdownItem}
              onPress={() => {
                setAddMenuOpen(false);
                handleAddScheme();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.addDropdownItemText}>Add Scheme</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Drag ghost — floats above everything while dragging */}
      {dragIdx !== -1 && assessments[dragIdx] != null && (
        <Modal visible transparent animationType="none">
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <View
              style={{
                position: "absolute",
                top: ghostTop,
                left: 0,
                right: 0,
                alignItems: "center",
                paddingHorizontal: 16,
              }}
            >
              <View
                style={[
                  styles.ghostCard,
                  Platform.OS === "web" &&
                    ({
                      boxShadow: "0 12px 40px rgba(0,0,0,0.65)",
                    } as any),
                ]}
              >
                <View style={styles.dragHandle}>
                  <Text style={styles.dragHandleText}>⠿</Text>
                </View>
                <View style={[styles.assessmentInner, { flex: 1 }]}>
                  <View style={styles.assessmentLeft}>
                    <Text style={styles.assessmentName}>
                      {assessments[dragIdx].name}
                    </Text>
                    <Text style={styles.assessmentWeight}>
                      Weight:{" "}
                      {activeScheme != null
                        ? (activeScheme.weights[assessments[dragIdx].id] ??
                          assessments[dragIdx].weight)
                        : assessments[dragIdx].weight}
                      %
                      {assessments[dragIdx].type === "bundle" &&
                        ` · Top ${assessments[dragIdx].countBest} of ${assessments[dragIdx].items?.length ?? 0}`}
                    </Text>
                  </View>
                  <View style={styles.assessmentRight}>
                    {assessments[dragIdx].type === "bundle" ? (
                      (() => {
                        const g = computeRepeatedGrade(assessments[dragIdx]);
                        return g !== null ? (
                          <Text style={styles.assessmentGrade}>
                            {g.toFixed(1)}%
                          </Text>
                        ) : (
                          <Text style={styles.assessmentPending}>—</Text>
                        );
                      })()
                    ) : assessments[dragIdx].grade !== null ? (
                      <Text style={styles.assessmentGrade}>
                        {assessments[dragIdx].grade!.toFixed(1)}%
                      </Text>
                    ) : (
                      <Text style={styles.assessmentPending}>—</Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === "web" ? 40 : 0,
  },
  headerWrapper: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
  },
  maxWidthContent: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backBtnText: {
    color: COLORS.accent,
    fontSize: 17,
    fontWeight: "600",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  deleteCourseBtnHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  deleteCourseText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  addButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  courseName: {
    color: COLORS.textMain,
    fontSize: 22,
    fontWeight: "700",
    paddingHorizontal: 20,
    marginBottom: 2,
  },
  subtitle: {
    color: COLORS.textDim,
    fontSize: 13,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 14,
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusChipActive: {
    borderWidth: 1,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textDim,
  },
  summaryCard: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
    marginHorizontal: 8,
  },
  summaryLabel: {
    color: COLORS.textDim,
    fontSize: 12,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  weightWarning: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.35)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  weightWarningText: {
    color: COLORS.danger,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  weightWarningClose: {
    padding: 2,
  },
  weightWarningCloseText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  listContainer: {
    paddingBottom: 100,
  },
  summarySticky: {
    width: "100%",
    backgroundColor: COLORS.bg,
  },
  summaryMaxWidth: {
    maxWidth: 900,
    alignSelf: "center",
    width: "100%",
  },
  assessmentCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
  },
  assessmentPlaceholder: {
    opacity: 0.3,
  },
  dragHandle: {
    width: 34,
    alignSelf: "stretch",
    justifyContent: "center",
    alignItems: "center",
  },
  dragHandleText: {
    color: COLORS.textDim,
    fontSize: 18,
    lineHeight: 22,
  },
  ghostCard: {
    width: "100%",
    maxWidth: 900,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 14,
    overflow: "hidden",
    transform: [{ scale: 1.03 }],
  },
  assessmentInner: {
    flex: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  assessmentLeft: {
    flex: 1,
  },
  assessmentName: {
    color: COLORS.textMain,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 3,
  },
  assessmentWeight: {
    color: COLORS.textDim,
    fontSize: 12,
  },
  assessmentRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  assessmentGrade: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: "800",
    minWidth: 52,
    textAlign: "right",
  },
  assessmentPending: {
    color: COLORS.textDim,
    fontSize: 16,
    fontWeight: "600",
    minWidth: 52,
    textAlign: "right",
  },
  deleteBtn: {
    padding: 4,
  },
  deleteBtnText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: "700",
  },

  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.textMain,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    color: COLORS.textDim,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    color: COLORS.textMain,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 20,
  },
  fieldLabel: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textMain,
    fontSize: 15,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  cancelBtnText: {
    color: COLORS.textDim,
    fontSize: 14,
    fontWeight: "600",
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: "rgba(167, 139, 250, 0.2)",
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: "center",
  },
  saveBtnText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  // Desired final grade card
  desiredCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
  },
  desiredTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  desiredTitle: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  desiredChevron: {
    color: COLORS.textDim,
    fontSize: 11,
  },
  desiredRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },
  desiredInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.textMain,
    fontSize: 16,
    fontWeight: "700",
    width: 90,
    textAlign: "center",
  },
  desiredPercent: {
    color: COLORS.textDim,
    fontSize: 16,
    fontWeight: "600",
  },
  desiredResultBox: {
    flex: 1,
    marginLeft: 8,
    justifyContent: "center",
  },
  desiredHint: {
    color: COLORS.textDim,
    fontSize: 13,
    fontStyle: "italic",
  },
  desiredResultInner: {
    gap: 2,
  },
  desiredResultLabel: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  desiredResultValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  // Bundle
  repeatedChevron: {
    color: COLORS.textDim,
    fontSize: 11,
    marginRight: 2,
  },
  editRepeatedBtn: {
    padding: 4,
  },
  editRepeatedBtnText: {
    color: COLORS.accent,
    fontSize: 15,
    fontWeight: "700",
  },
  repeatedItemsWrapper: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginBottom: 10,
  },
  repeatedItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  repeatedItemLabel: {
    color: COLORS.textDim,
    fontSize: 13,
    flex: 1,
  },
  repeatedItemInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: COLORS.textMain,
    fontSize: 14,
    width: 80,
    textAlign: "center",
  },
  repeatedItemPercent: {
    color: COLORS.textDim,
    fontSize: 13,
    width: 14,
  },
  addDropdown: {
    position: "absolute",
    top: 56, // overridden at runtime via dropdownTop
    right: 20, // overridden at runtime via dropdownRight
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    overflow: "hidden",
    minWidth: 220,
    zIndex: 1000,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 8px 32px rgba(0,0,0,0.55)" } as any)
      : {}),
  },
  addDropdownItem: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  addDropdownItemText: {
    color: COLORS.textMain,
    fontSize: 14,
    fontWeight: "600",
  },
  addDropdownDivider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  schemeTabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
    flexWrap: "wrap",
  },
  schemeTabActive: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(167, 139, 250, 0.15)",
  },
  schemeTabText: {
    color: COLORS.textDim,
    fontSize: 13,
    fontWeight: "600",
  },
  schemeTabTextActive: {
    color: COLORS.accent,
  },
  schemeTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  schemeTabDelete: {
    opacity: 0.5,
  },
  schemeTabDeleteText: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: "700",
  },
  schemeTabDeleteTextActive: {
    color: COLORS.accent,
    opacity: 1,
  },
});
