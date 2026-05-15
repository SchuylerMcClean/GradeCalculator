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

import {
  addAssessment,
  type Assessment,
  deleteAssessment,
  subscribeToAssessments,
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

export default function CourseDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const router = useRouter();

  const courseName = name ?? "Course";
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = subscribeToAssessments(id, (data) => {
      setAssessments(data);
      setLoading(false);
    });
    return unsubscribe;
  }, [id]);

  // Keep the course's computed grade in sync
  useEffect(() => {
    if (!id || loading) return;
    const grade = computeGrade(assessments);
    updateCourse(id, { grade: grade ?? undefined }).catch(() => {});
  }, [assessments, id, loading]);

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
        await addAssessment(id!, { name: trimmedName, weight, score });
      }
      setModalVisible(false);
    } catch (e) {
      Alert.alert("Error", "Failed to save assessment. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (assessment: Assessment) => {
    Alert.alert(
      "Delete Assessment",
      `Remove "${assessment.name}" from this course?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAssessment(id!, assessment.id);
            } catch (e) {
              Alert.alert("Error", "Failed to delete assessment.");
            }
          },
        },
      ],
    );
  };

  const calculatedGrade = computeGrade(assessments);
  const totalWeight = assessments.reduce((sum, a) => sum + a.weight, 0);

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

  const renderAssessment = ({ item }: { item: Assessment }) => (
    <TouchableOpacity
      style={styles.assessmentCard}
      onPress={() => openEdit(item)}
      activeOpacity={0.7}
    >
      <View style={styles.assessmentLeft}>
        <Text style={styles.assessmentName}>{item.name}</Text>
        <Text style={styles.assessmentWeight}>Weight: {item.weight}%</Text>
      </View>
      <View style={styles.assessmentRight}>
        {item.score !== null ? (
          <Text style={styles.assessmentScore}>{item.score.toFixed(1)}%</Text>
        ) : (
          <Text style={styles.assessmentPending}>—</Text>
        )}
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.addButton} onPress={openAdd}>
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.courseName}>{courseName}</Text>
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

      <FlatList
        data={assessments}
        renderItem={renderAssessment}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>📝</Text>
            <Text style={styles.emptyTitle}>No Assessments Yet</Text>
            <Text style={styles.emptyText}>
              Tap "+ Add" to add your first assessment component.
            </Text>
          </View>
        }
      />

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
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
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
