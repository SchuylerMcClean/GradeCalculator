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

import {
  addCourse,
  type Course,
  type CourseStatus,
  deleteCourse,
  subscribeToCourses,
} from "@/lib/firestore";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
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

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Add-course modal
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToCourses((data) => {
      setCourses(data);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleCoursePress = (course: Course) => {
    router.push({
      pathname: "/course/[id]" as any,
      params: { id: course.id, name: course.name },
    });
  };

  const handleAddCourse = async () => {
    if (!form.name.trim()) {
      Alert.alert("Validation", "Please enter a course name.");
      return;
    }
    setSaving(true);
    try {
      await addCourse({
        name: form.name.trim(),
        instructor: form.instructor.trim() || undefined,
        status: form.status,
      });
      setModalVisible(false);
      setForm(EMPTY_FORM);
    } catch (e) {
      Alert.alert("Error", "Failed to add course. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCourse = (course: Course) => {
    Alert.alert(
      "Delete Course",
      `Remove "${course.name}" and all its assessments?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteCourse(course.id);
            } catch (e) {
              Alert.alert("Error", "Failed to delete course.");
            }
          },
        },
      ],
    );
  };

  const handleRefresh = () => {}; // real-time listener keeps data fresh automatically

  const getStatusColor = (status: CourseStatus) => {
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
  };

  const renderCourseCard = ({ item }: { item: Course }) => (
    <TouchableOpacity
      style={styles.courseCard}
      onPress={() => handleCoursePress(item)}
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
            onPress={() => handleDeleteCourse(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {item.instructor && (
        <Text style={styles.instructorText}>Instructor: {item.instructor}</Text>
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
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>📚</Text>
      <Text style={styles.emptyTitle}>No Courses Yet</Text>
      <Text style={styles.emptyText}>
        Add your first course to start tracking your grades!
      </Text>
    </View>
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Courses</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={courses}
        renderItem={renderCourseCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />

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
    marginBottom: 18,
  },
  headerTitle: {
    color: COLORS.textMain,
    fontSize: 20,
    fontWeight: "700",
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
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  courseCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
