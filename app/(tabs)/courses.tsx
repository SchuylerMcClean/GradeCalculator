const COLORS = {
  bg: "#020617",
  card: "rgba(255, 255, 255, 0.05)",
  border: "rgba(255, 255, 255, 0.12)",
  accent: "#a78bfa", // Soft Violet
  success: "#4ade80",
  danger: "#f87171",
  textMain: "#f8fafc",
  textDim: "#94a3b8",
};

import { useAuth } from "@/lib/auth-context";
import { confirmAction } from "@/lib/confirm";
import { auth } from "@/lib/firebase";
import {
  addCourse,
  batchUpdateCourseOrders,
  type Course,
  type CourseStatus,
  deleteCourse,
  initCourseOrder,
  subscribeToCourses,
} from "@/lib/firestore";
import { useRouter } from "expo-router";
import { signOut } from "firebase/auth";
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

const STATUS_OPTIONS: CourseStatus[] = ["active", "completed", "planned"];
const EMPTY_FORM = {
  name: "",
  instructor: "",
  status: "active" as CourseStatus,
};

// ─── Helpers & sub-components ─────────────────────────────────────────────────

function getStatusColor(status: CourseStatus): string {
  switch (status) {
    case "active":
      return "#4CAF50";
    case "completed":
      return "#2196F3";
    case "planned":
      return "#FF9800";
    default:
      return "#757575";
  }
}

interface CourseCardProps {
  item: Course;
  isDragging: boolean;
  onPress: () => void;
  onDelete: () => void;
  onDragStart: (clientY: number, cardClientY: number) => void;
  onItemLayout: (height: number) => void;
}

function CourseCard({
  item,
  isDragging,
  onPress,
  onDelete,
  onDragStart,
  onItemLayout,
}: CourseCardProps) {
  const cardRef = useRef<any>(null);
  return (
    <View onLayout={(e) => onItemLayout(e.nativeEvent.layout.height)}>
      <View
        ref={cardRef}
        style={[styles.courseCard, isDragging && styles.coursePlaceholder]}
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
          style={styles.courseCardInner}
          onPress={onPress}
          activeOpacity={0.7}
        >
          <View style={styles.courseHeader}>
            <Text style={styles.courseName}>{item.name}</Text>
            <View style={styles.courseHeaderRight}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(item.status) },
                ]}
              >
                <Text style={styles.statusText}>
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onDelete}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.deleteBtn}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
          {item.instructor && (
            <Text style={styles.instructorText}>
              Instructor: {item.instructor}
            </Text>
          )}
          <View style={styles.courseDetails}>
            {item.grade !== undefined && (
              <View style={styles.gradeContainer}>
                <Text style={styles.gradeLabel}>Current Grade:</Text>
                <Text style={styles.gradeValue}>{item.grade.toFixed(1)}%</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CoursesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid ?? "";
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add-course modal
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // ─── Drag state ───────────────────────────────────────────────────────────────
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

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribeToCourses(uid, (data) => {
      setCourses(data);
      setLoading(false);
      initCourseOrder(uid, data).catch(() => {});
    });
    return unsubscribe;
  }, [uid]);

  const handleCoursePress = (course: Course) => {
    router.push({
      pathname: "/course/[id]" as any,
      params: { id: course.id, name: course.name, status: course.status },
    });
  };

  const handleAddCourse = async () => {
    if (!form.name.trim()) {
      Alert.alert("Validation", "Please enter a course name.");
      return;
    }
    setSaving(true);
    try {
      await addCourse(uid, {
        name: form.name.trim(),
        instructor: form.instructor.trim() || undefined,
        status: form.status,
        order: courses.length,
      });
      setModalVisible(false);
      setForm(EMPTY_FORM);
    } catch (e) {
      Alert.alert("Error", "Failed to add course. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCourse = async (course: Course) => {
    console.log("[DELETE COURSE] Confirming for:", course.id, course.name);
    const confirmed = await confirmAction(
      "Delete Course",
      `Remove "${course.name}" and all its assessments?`,
    );
    if (!confirmed) {
      console.log("[DELETE COURSE] Cancelled");
      return;
    }
    console.log(
      "[DELETE COURSE] Confirmed, calling deleteCourse(",
      course.id,
      ")",
    );
    try {
      await deleteCourse(uid, course.id);
      console.log("[DELETE COURSE] Success:", course.id);
    } catch (e) {
      console.error("[DELETE COURSE] Error:", e);
      Alert.alert("Error", "Failed to delete course.");
    }
  };

  const displayCourses = useMemo(() => {
    if (dragIdx === -1 || hoverIdx === -1 || hoverIdx === dragIdx)
      return courses;
    const arr = [...courses];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(hoverIdx, 0, moved);
    return arr;
  }, [courses, dragIdx, hoverIdx]);

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
      const itemCount = courses.length;
      const MARGIN = 12;

      const computeHover = (y: number): number => {
        const relY = y - listTopRef.current + listScrollRef.current;
        let accY = 0;
        for (let i = 0; i < itemCount; i++) {
          const h = itemHeightsRef.current[i] ?? 90;
          if (relY < accY + h / 2) return i;
          accY += h + MARGIN;
        }
        return itemCount - 1;
      };

      const commit = async (from: number, to: number) => {
        const arr = [...courses];
        const [moved] = arr.splice(from, 1);
        arr.splice(to, 0, moved);
        try {
          await batchUpdateCourseOrders(
            uid,
            arr.map((c, i) => ({ id: c.id, order: i })),
          );
        } catch {
          Alert.alert("Error", "Failed to reorder courses.");
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
    [courses, uid],
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.loadingText}>Loading your courses...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.maxWidthContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Courses</Text>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setModalVisible(true)}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={async () => {
                await signOut(auth);
                router.replace("/(auth)/login" as any);
              }}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
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
            {displayCourses.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>📚</Text>
                <Text style={styles.emptyTitle}>No Courses Yet</Text>
                <Text style={styles.emptyText}>
                  Add your first course to start tracking your grades!
                </Text>
              </View>
            ) : (
              displayCourses.map((item) => {
                const courseIndex = courses.findIndex((c) => c.id === item.id);
                const isDragging =
                  dragIdx !== -1 && item.id === courses[dragIdx]?.id;
                return (
                  <CourseCard
                    key={item.id}
                    item={item}
                    isDragging={isDragging}
                    onPress={() => handleCoursePress(item)}
                    onDelete={() => handleDeleteCourse(item)}
                    onDragStart={(clientY, cardTop) =>
                      handleDragStart(courseIndex, clientY, cardTop)
                    }
                    onItemLayout={(height) => {
                      itemHeightsRef.current[courseIndex] = height;
                    }}
                  />
                );
              })
            )}
          </ScrollView>
        </View>
      </View>

      {/* Add Course Modal */}
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
            <Text style={styles.modalTitle}>Add Course</Text>

            <Text style={styles.fieldLabel}>Course Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Mathematics 101"
              placeholderTextColor={COLORS.textDim}
              value={form.name}
              onChangeText={(v) => setForm((f) => ({ ...f, name: v }))}
            />

            <Text style={styles.fieldLabel}>Instructor (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Dr. Smith"
              placeholderTextColor={COLORS.textDim}
              value={form.instructor}
              onChangeText={(v) => setForm((f) => ({ ...f, instructor: v }))}
            />

            <Text style={styles.fieldLabel}>Status</Text>
            <View style={styles.statusRow}>
              {STATUS_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.statusOption,
                    form.status === s && styles.statusOptionActive,
                  ]}
                  onPress={() => setForm((f) => ({ ...f, status: s }))}
                >
                  <Text
                    style={[
                      styles.statusOptionText,
                      form.status === s && styles.statusOptionTextActive,
                    ]}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setModalVisible(false);
                  setForm(EMPTY_FORM);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleAddCourse}
                disabled={saving}
              >
                <Text style={styles.saveBtnText}>
                  {saving ? "Saving..." : "Add Course"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Drag ghost */}
      {dragIdx !== -1 && courses[dragIdx] != null && (
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
                    ({ boxShadow: "0 12px 40px rgba(0,0,0,0.65)" } as any),
                ]}
              >
                <View style={styles.dragHandle}>
                  <Text style={styles.dragHandleText}>⠿</Text>
                </View>
                <View style={styles.courseCardInner}>
                  <View style={styles.courseHeader}>
                    <Text style={styles.courseName}>
                      {courses[dragIdx].name}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        {
                          backgroundColor: getStatusColor(
                            courses[dragIdx].status,
                          ),
                        },
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {courses[dragIdx].status.charAt(0).toUpperCase() +
                          courses[dragIdx].status.slice(1)}
                      </Text>
                    </View>
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
    paddingTop: 40,
  },
  maxWidthContent: {
    flex: 1,
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  headerTitle: {
    color: COLORS.textMain,
    fontSize: 20,
    fontWeight: "700",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accent,
    backgroundColor: "transparent",
  },
  addButtonText: {
    color: COLORS.accent,
    fontSize: 18,
    fontWeight: "800",
  },
  signOutBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  signOutText: {
    color: COLORS.textDim,
    fontSize: 13,
    fontWeight: "600",
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  courseCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
  },
  courseCardInner: {
    flex: 1,
    padding: 16,
  },
  coursePlaceholder: {
    opacity: 0.3,
  },
  dragHandle: {
    width: 34,
    alignSelf: "center",
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
    borderRadius: 16,
    overflow: "hidden",
    transform: [{ scale: 1.03 }],
  },
  courseHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  courseHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deleteBtn: {
    padding: 4,
  },
  deleteBtnText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  courseName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textMain,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 10,
  },
  statusText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  instructorText: {
    fontSize: 13,
    color: COLORS.textDim,
    marginBottom: 6,
  },
  courseDetails: {
    marginTop: 6,
  },
  detailText: {
    fontSize: 13,
    color: COLORS.textDim,
    marginBottom: 4,
  },
  gradeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  gradeLabel: {
    fontSize: 13,
    color: COLORS.textDim,
    marginRight: 8,
  },
  gradeValue: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.accent,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.bg,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: COLORS.textDim,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textMain,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textDim,
    textAlign: "center",
    paddingHorizontal: 32,
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    paddingBottom: 40,
    width: "100%",
    maxWidth: 900,
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
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: COLORS.textMain,
    fontSize: 15,
  },
  statusRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  statusOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  statusOptionActive: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(167, 139, 250, 0.15)",
  },
  statusOptionText: {
    color: COLORS.textDim,
    fontSize: 13,
    fontWeight: "600",
  },
  statusOptionTextActive: {
    color: COLORS.accent,
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
