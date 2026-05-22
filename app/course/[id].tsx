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
  View,
} from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { confirmAction } from "@/lib/confirm";
import {
  addAssessment,
  type Assessment,
  batchUpdateOrders,
  type CourseStatus,
  deleteAssessment,
  deleteCourse,
  initAssessmentOrder,
  subscribeToAssessments,
  swapAssessmentOrder,
  updateAssessment,
  updateCourse,
} from "@/lib/firestore";

function computeGrade(assessments: Assessment[]): number | null {
  const graded = assessments.filter((a) => a.score !== null);
  if (graded.length === 0) return null;
  const totalWeight = graded.reduce((sum, a) => sum + a.weight, 0);
  if (totalWeight === 0) return null;
  const weightedSum = graded.reduce(
    (sum, a) => sum + (a.score as number) * a.weight,
    0,
  );
  return weightedSum / totalWeight;
}

const EMPTY_FORM = { name: "", weight: "", score: "" };

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
            {item.score !== null ? (
              <Text style={styles.assessmentScore}>
                {item.score.toFixed(1)}%
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

  const courseName = name ?? "Course";
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [courseStatus, setCourseStatus] = useState<CourseStatus>(
    (initialStatus as CourseStatus) ?? "active",
  );

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const deletingRef = useRef(false);
  const [flashKeys, setFlashKeys] = useState<Record<string, number>>({});

  // ─── Drag-and-drop state ─────────────────────────────────────────────────────
  const [dragIdx, setDragIdx] = useState(-1);
  const [hoverIdx, setHoverIdx] = useState(-1);
  const [ghostTop, setGhostTop] = useState(0);
  const dragIdxRef = useRef(-1);
  const hoverIdxRef = useRef(-1);
  const itemHeightsRef = useRef<number[]>([]);
  const listTopRef = useRef(0);
  const listScrollRef = useRef(0);
  const listViewRef = useRef<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const scoreInputRef = useRef<any>(null);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeToAssessments(id, (data) => {
      setAssessments(data);
      setLoading(false);
      // Migrate existing assessments that don't have an order field yet
      initAssessmentOrder(id, data).catch(() => {});
    });
    return unsubscribe;
  }, [id]);

  // Keep the course's computed grade in sync
  useEffect(() => {
    if (!id || loading || deletingRef.current) return;
    const grade = computeGrade(assessments);
    if (grade === null) return;
    updateCourse(id, { grade }).catch(() => {});
  }, [assessments, id, loading]);

  const handleDeleteCourse = async () => {
    console.log("[DELETE COURSE] Confirming for course:", id, courseName);
    const confirmed = await confirmAction(
      "Delete Course",
      `Remove "${courseName}" and all its assessments? This cannot be undone.`,
    );
    if (!confirmed) {
      console.log("[DELETE COURSE] Cancelled");
      return;
    }
    console.log("[DELETE COURSE] Confirmed, calling deleteCourse(", id, ")");
    deletingRef.current = true;
    try {
      await deleteCourse(id!);
      console.log("[DELETE COURSE] Success, navigating to courses tab");
      router.replace("/(tabs)/courses" as any);
    } catch (e) {
      deletingRef.current = false;
      console.error("[DELETE COURSE] Error:", e);
      Alert.alert("Error", "Failed to delete course. Please try again.");
    }
  };

  const handleStatusChange = async (newStatus: CourseStatus) => {
    if (newStatus === courseStatus) return;
    setCourseStatus(newStatus);
    try {
      await updateCourse(id!, { status: newStatus });
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
    setEditingId(assessment.id);
    setForm({
      name: assessment.name,
      weight: String(assessment.weight),
      score: assessment.score !== null ? String(assessment.score) : "",
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
    let score: number | null = null;
    if (form.score.trim() !== "") {
      score = parseFloat(form.score);
      if (isNaN(score) || score < 0 || score > 100) {
        Alert.alert("Validation", "Score must be a number between 0 and 100.");
        return;
      }
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateAssessment(id!, editingId, {
          name: trimmedName,
          weight,
          score,
        });
      } else {
        await addAssessment(id!, {
          name: trimmedName,
          weight,
          score,
          order: assessments.length,
        });
      }
      setModalVisible(false);
    } catch (e) {
      Alert.alert("Error", "Failed to save assessment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (assessment: Assessment) => {
    console.log(
      "[DELETE ASSESSMENT] Confirming for:",
      assessment.id,
      assessment.name,
    );
    const confirmed = await confirmAction(
      "Delete Assessment",
      `Remove "${assessment.name}" from this course?`,
    );
    if (!confirmed) {
      console.log("[DELETE ASSESSMENT] Cancelled");
      return;
    }
    console.log(
      "[DELETE ASSESSMENT] Confirmed, calling deleteAssessment(",
      id,
      assessment.id,
      ")",
    );
    try {
      await deleteAssessment(id!, assessment.id);
      console.log("[DELETE ASSESSMENT] Success:", assessment.id);
    } catch (e) {
      console.error("[DELETE ASSESSMENT] Error:", e);
      Alert.alert("Error", "Failed to delete assessment.");
    }
  };

  const calculatedGrade = computeGrade(assessments);
  const totalWeight = assessments.reduce((sum, a) => sum + a.weight, 0);

  const moveAssessment = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= assessments.length) return;
    const a = assessments[index];
    const b = assessments[targetIndex];
    setFlashKeys((prev) => ({
      ...prev,
      [a.id]: (prev[a.id] ?? 0) + 1,
      [b.id]: (prev[b.id] ?? 0) + 1,
    }));
    try {
      await swapAssessmentOrder(id!, a.id, a.order, b.id, b.order);
    } catch (e) {
      Alert.alert("Error", "Failed to reorder assessments.");
    }
  };

  // ─── Drag helpers ─────────────────────────────────────────────────────────────

  const displayAssessments = useMemo(() => {
    if (dragIdx === -1 || hoverIdx === -1 || hoverIdx === dragIdx)
      return assessments;
    const arr = [...assessments];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(hoverIdx, 0, moved);
    return arr;
  }, [assessments, dragIdx, hoverIdx]);

  const handleDragStart = useCallback(
    (index: number, clientY: number, cardTop: number) => {
      if (Platform.OS !== "web") return;
      const doc = typeof document !== "undefined" ? document : null;
      if (!doc) return;

      const offset = clientY - cardTop;
      const listRect = listViewRef.current?.getBoundingClientRect?.();
      listTopRef.current = listRect?.top ?? 0;

      dragIdxRef.current = index;
      hoverIdxRef.current = index;
      setDragIdx(index);
      setHoverIdx(index);
      setGhostTop(clientY - offset);

      const itemCount = assessments.length;
      const MARGIN = 10;

      const computeHover = (y: number): number => {
        const relY = y - listTopRef.current + listScrollRef.current;
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
    [assessments, id],
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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
          <TouchableOpacity style={styles.addButton} onPress={openAdd}>
            <Text style={styles.addButtonText}>+ Add</Text>
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

      <Text style={styles.subtitle}>Assessment Components</Text>

      {/* Grade summary */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Calculated Grade</Text>
          <Text
            style={[
              styles.summaryValue,
              {
                color:
                  calculatedGrade !== null ? COLORS.success : COLORS.textDim,
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
          <Text style={styles.summaryLabel}>Total Weight</Text>
          <Text
            style={[
              styles.summaryValue,
              { color: totalWeight === 100 ? COLORS.success : COLORS.danger },
            ]}
          >
            {totalWeight}%
          </Text>
        </View>
      </View>

      <View ref={listViewRef} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => {
            listScrollRef.current = e.nativeEvent.contentOffset.y;
          }}
        >
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
        </ScrollView>
      </View>

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
            <TextInput
              style={styles.input}
              placeholder="e.g. Midterm Exam"
              placeholderTextColor={COLORS.textDim}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            />

            <Text style={styles.fieldLabel}>Weight (%)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 30"
              placeholderTextColor={COLORS.textDim}
              keyboardType="decimal-pad"
              value={form.weight}
              onChangeText={(v) => setForm((f) => ({ ...f, weight: v }))}
            />

            <Text style={styles.fieldLabel}>
              Score (%) — leave blank if not graded
            </Text>
            <TextInput
              ref={scoreInputRef}
              style={styles.input}
              placeholder="e.g. 85"
              placeholderTextColor={COLORS.textDim}
              keyboardType="decimal-pad"
              value={form.score}
              onChangeText={(v) => setForm((f) => ({ ...f, score: v }))}
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

      {/* Drag ghost — floats above everything while dragging */}
      {dragIdx !== -1 && assessments[dragIdx] != null && (
        <Modal visible transparent animationType="none">
          <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
            <View
              style={[
                styles.ghostCard,
                Platform.OS === "web" &&
                  ({
                    boxShadow: "0 12px 40px rgba(0,0,0,0.65)",
                  } as any),
                { top: ghostTop },
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
                    Weight: {assessments[dragIdx].weight}%
                  </Text>
                </View>
                <View style={styles.assessmentRight}>
                  {assessments[dragIdx].score !== null ? (
                    <Text style={styles.assessmentScore}>
                      {assessments[dragIdx].score!.toFixed(1)}%
                    </Text>
                  ) : (
                    <Text style={styles.assessmentPending}>—</Text>
                  )}
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
    paddingTop: 40,
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
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 80,
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
    position: "absolute",
    left: 16,
    right: 16,
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
  assessmentScore: {
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
});
