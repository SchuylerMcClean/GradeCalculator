import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AppTextInput } from "@/components/app-text-input";

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

const InputRow = ({
  grade,
  worth,
  onChangeGrade,
  onChangeWorth,
  onDelete,
}: {
  grade: string;
  worth: string;
  onChangeGrade: (g: string) => void;
  onChangeWorth: (w: string) => void;
  onDelete: () => void;
}) => {
  return (
    <View style={styles.inputRowCard}>
      <AppTextInput
        style={styles.inputBox}
        placeholder="Grade (%)"
        placeholderTextColor={COLORS.textDim}
        keyboardType="numeric"
        value={grade}
        onChangeText={onChangeGrade}
      />
      <AppTextInput
        style={styles.inputBox}
        placeholder="Weight (%)"
        placeholderTextColor={COLORS.textDim}
        keyboardType="numeric"
        value={worth}
        onChangeText={onChangeWorth}
      />
      <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
        <Text style={{ color: COLORS.danger, fontWeight: "bold" }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function HomeScreen() {
  const [rows, setRows] = useState([
    { id: "1", grade: "", worth: "", gradePortion: 0 },
  ]);
  const [gradeGoal, setGradeGoal] = useState("");

  const addRow = () => {
    setRows([
      ...rows,
      { id: Date.now().toString(), grade: "", worth: "", gradePortion: 0 },
    ]);
  };

  const removeRow = (id: string) =>
    setRows(rows.filter((row) => row.id !== id));

  const updateRow = (id: string, field: "grade" | "worth", value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id === id) {
          const updatedRow = { ...row, [field]: value };
          const g = Number(updatedRow.grade) || 0;
          const w = Number(updatedRow.worth) || 0;
          updatedRow.gradePortion = g * w * 0.01;
          return updatedRow;
        }
        return row;
      }),
    );
  };

  const gradePortionSum = rows.reduce((sum, r) => sum + r.gradePortion, 0);
  const worthSum = rows.reduce((sum, r) => sum + Number(r.worth), 0);
  const total = worthSum === 0 ? 0 : (gradePortionSum / worthSum) * 100;

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.maxWidthContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Grade Calculator</Text>
            <View style={styles.totalBadge}>
              <Text style={styles.totalText}>{total.toFixed(1)}%</Text>
            </View>
          </View>

          <View style={styles.sectionLabelContainer}>
            <Text style={styles.sectionLabel}>ASSESSMENT COMPONENTS</Text>
          </View>

          {rows.map((row) => (
            <InputRow
              key={row.id}
              grade={row.grade}
              worth={row.worth}
              onChangeGrade={(g) => updateRow(row.id, "grade", g)}
              onChangeWorth={(w) => updateRow(row.id, "worth", w)}
              onDelete={() => removeRow(row.id)}
            />
          ))}

          <TouchableOpacity style={styles.addButton} onPress={addRow}>
            <Text style={styles.addButtonText}>+ Add Component</Text>
          </TouchableOpacity>

          {/* Predictive AI Box */}
          {worthSum > 0 && worthSum < 100 && (
            <View style={styles.aiCard}>
              <View style={styles.goalInputRow}>
                <Text style={styles.aiBody}>Desired Final Grade:</Text>
                <AppTextInput
                  style={styles.smallInput}
                  value={gradeGoal}
                  onChangeText={setGradeGoal}
                  keyboardType="numeric"
                  placeholder="90"
                  placeholderTextColor={COLORS.textDim}
                />
              </View>
              <Text style={styles.aiPrediction}>
                {gradeGoal
                  ? (() => {
                      const needed =
                        ((Number(gradeGoal) - gradePortionSum) /
                          (100 - worthSum)) *
                        100;
                      return needed > 100
                        ? `It is impossible to receive your desired grade. You need ${needed.toFixed(1)}% on remaining tasks.`
                        : needed < 0
                          ? "You have already guaranteed your desired grade."
                          : `You need ${needed.toFixed(1)}% on remaining tasks.`;
                    })()
                  : "Enter a target grade to see what you need on remaining assessments to achieve it."}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 40 },
  maxWidthContent: {
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  title: {
    color: COLORS.textMain,
    fontSize: 20,
    fontWeight: "700",
  },
  totalBadge: {
    backgroundColor: "rgba(167, 139, 250, 0.15)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  totalText: { color: COLORS.accent, fontSize: 18, fontWeight: "700" },
  scrollContent: { flexGrow: 1 },
  sectionLabelContainer: { marginBottom: 12, paddingLeft: 4 },
  sectionLabel: {
    color: COLORS.textDim,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "600",
  },
  inputRowCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    flexDirection: "row",
    padding: 12,
    gap: 12,
    marginBottom: 12,
    alignItems: "center",
  },
  inputBox: {
    flex: 1,
    height: 45,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    color: COLORS.textMain,
    textAlign: "center",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  deleteButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  addButton: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  addButtonText: { color: COLORS.accent, fontSize: 14, fontWeight: "700" },
  aiCard: {
    marginTop: 40,
    backgroundColor: "rgba(167, 139, 250, 0.08)",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
  },
  aiTitle: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 10,
  },
  goalInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  aiBody: { color: COLORS.textMain, fontSize: 16 },
  smallInput: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.accent,
    color: COLORS.textMain,
    fontSize: 18,
    width: 50,
    textAlign: "center",
  },
  aiPrediction: { color: COLORS.textDim, fontSize: 14, lineHeight: 20 },
});
