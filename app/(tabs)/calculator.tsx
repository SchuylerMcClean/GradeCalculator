import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

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
      <TextInput
        style={styles.inputBox}
        placeholder="Grade"
        placeholderTextColor={COLORS.textDim}
        keyboardType="numeric"
        value={grade}
        onChangeText={onChangeGrade}
      />
      <TextInput
        style={styles.inputBox}
        placeholder="Weight"
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
  const { height } = useWindowDimensions();
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
    <View style={[styles.page, { height }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Grade Calculator</Text>
        <View style={styles.totalBadge}>
          <Text style={styles.totalText}>{total.toFixed(1)}%</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
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
          <Text style={styles.addButtonText}>+ ADD COMPONENT</Text>
        </TouchableOpacity>

        {/* Predictive AI Box */}
        {worthSum > 0 && worthSum < 100 && (
          <View style={styles.aiCard}>
            <Text style={styles.aiTitle}>✨ PREDICTIVE INSIGHT</Text>
            <View style={styles.goalInputRow}>
              <Text style={styles.aiBody}>Target Grade:</Text>
              <TextInput
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
                ? `You need ${(((Number(gradeGoal) - gradePortionSum) / (100 - worthSum)) * 100).toFixed(1)}% on remaining tasks.`
                : "Enter a goal to see your path to success."}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { backgroundColor: COLORS.bg, paddingTop: 60 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 30,
  },
  title: {
    color: COLORS.textMain,
    fontSize: 24,
    fontWeight: "200",
    letterSpacing: 1,
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
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
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
    borderRadius: 20,
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
    borderStyle: "dashed",
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  addButtonText: { color: COLORS.textDim, fontSize: 12, fontWeight: "600" },
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
