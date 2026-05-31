import React, { useEffect, useMemo, useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AppTextInput } from "@/components/app-text-input";

const COOKIE_KEY = "calculator_state";

function readCookie(): {
  rows: { id: string; grade: string; worth: string; gradePortion: number }[];
  desiredGrade: string;
} | null {
  if (typeof document === "undefined") return null;
  const entry = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith(COOKIE_KEY + "="));
  if (!entry) return null;
  try {
    return JSON.parse(decodeURIComponent(entry.split("=").slice(1).join("=")));
  } catch {
    return null;
  }
}

function writeCookie(data: {
  rows: { id: string; grade: string; worth: string; gradePortion: number }[];
  desiredGrade: string;
}) {
  if (typeof document === "undefined") return;
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(data))}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

const COLORS = {
  bg: "#020617",
  card: "rgba(255, 255, 255, 0.05)",
  border: "rgba(255, 255, 255, 0.12)",
  accent: "#a78bfa", // Soft Violet
  success: "#4ade80",
  danger: "#f87171",
  textMain: "#f8fafc",
  textDim: "#94a3b8",
  inputBg: "rgba(255, 255, 255, 0.08)",
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
        placeholder="Assessment Name"
        placeholderTextColor={COLORS.textDim}
        keyboardType="default"
      />
      <AppTextInput
        style={styles.inputBox}
        placeholder="Weight %"
        placeholderTextColor={COLORS.textDim}
        keyboardType="numeric"
        value={worth}
        onChangeText={onChangeWorth}
      />
      <AppTextInput
        style={styles.inputBox}
        placeholder="Grade %"
        placeholderTextColor={COLORS.textDim}
        keyboardType="numeric"
        value={grade}
        onChangeText={onChangeGrade}
      />
      <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
        <Text style={{ color: COLORS.danger, fontWeight: "bold" }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
};

export default function HomeScreen() {
  const saved = readCookie();
  const [rows, setRows] = useState(
    saved?.rows ?? [{ id: "1", grade: "", worth: "", gradePortion: 0 }],
  );
  const [desiredGrade, setDesiredGrade] = useState(saved?.desiredGrade ?? "");

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
  const gradedWorthSum = rows.reduce(
    (sum, r) => (r.grade !== "" ? sum + Number(r.worth) : sum),
    0,
  );
  const total = worthSum === 0 ? 0 : (gradePortionSum / worthSum) * 100;
  const calculatedGrade = gradedWorthSum === 0 ? null : total;

  const [weightWarningDismissed, setWeightWarningDismissed] = useState(false);
  useEffect(() => {
    setWeightWarningDismissed(false);
  }, [worthSum]);

  useEffect(() => {
    writeCookie({ rows, desiredGrade });
  }, [rows, desiredGrade]);

  const requiredScore = useMemo((): number | null => {
    const desired = parseFloat(desiredGrade);
    if (isNaN(desired) || desired < 0 || desired > 100) return null;
    const remainingWeight = 100 - worthSum;
    if (remainingWeight <= 0) return null;
    return ((desired - gradePortionSum) / remainingWeight) * 100;
  }, [desiredGrade, gradePortionSum, worthSum]);

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.maxWidthContent}>
          <View style={styles.header}>
            <Text style={styles.title}>Grade Calculator</Text>
            <TouchableOpacity style={styles.addButton} onPress={addRow}>
              <Text style={styles.addButtonText}>+ Add Component</Text>
            </TouchableOpacity>
          </View>

          {/* Desired final grade */}
          {gradePortionSum > 0 && (
            <View style={styles.desiredCard}>
              <View style={styles.desiredTitleRow}>
                <Text style={styles.desiredTitle}>Desired Final Grade</Text>
              </View>
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
                    <Text style={styles.desiredHint}>Enter a target grade</Text>
                  ) : requiredScore === null ? (
                    worthSum >= 100 ? (
                      <Text style={styles.desiredHint}>
                        All assessments fully graded. Add ungraded items to
                        calculate required score.
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
            </View>
          )}

          <View style={styles.sectionLabelContainer}>
            <Text style={styles.sectionLabel}>ASSESSMENT COMPONENTS</Text>
          </View>

          {/* Grade summary */}
          {gradePortionSum > 0 && (
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
                <Text style={styles.summaryLabel}>Grade Earned So Far</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    {
                      color:
                        gradePortionSum === 0
                          ? COLORS.textDim
                          : gradePortionSum < 50
                            ? COLORS.danger
                            : gradePortionSum < 80
                              ? "#facc15"
                              : COLORS.success,
                    },
                  ]}
                >
                  {gradePortionSum.toFixed(1)}%
                </Text>
              </View>
              <View style={styles.summaryDivider} />

              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Total Weight</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    {
                      color: worthSum === 100 ? COLORS.success : COLORS.danger,
                    },
                  ]}
                >
                  {worthSum}%
                </Text>
              </View>
            </View>
          )}

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
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  addButtonText: { color: COLORS.accent, fontSize: 14, fontWeight: "700" },
  summaryCard: {
    flexDirection: "row",
    marginBottom: 12,
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
  desiredCard: {
    marginBottom: 24,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
  },
  desiredTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  desiredTitle: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
});
