import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AppTextInput } from "@/components/app-text-input";

//  Types

type BundleItem = { id: string; grade: string };

type SingleRow = {
  id: string;
  type: "single";
  name: string;
  weight: string;
  grade: string;
};

type BundleRow = {
  id: string;
  type: "bundle";
  name: string;
  weight: string;
  countBest: number;
  items: BundleItem[];
};

type Row = SingleRow | BundleRow;

type CalcScheme = {
  id: string;
  name: string;
  weights: Record<string, string>;
};

type CalcState = {
  rows: Row[];
  desiredGrade: string;
  schemes: CalcScheme[];
};

//  Cookie persistence (new key to avoid conflict with old shape)

const COOKIE_KEY = "calculator_state_v2";

function readCookie(): CalcState | null {
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

function writeCookie(data: CalcState) {
  if (typeof document === "undefined") return;
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(JSON.stringify(data))}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

//  Colours

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

//  Grade helpers

function computeBundleGrade(
  items: BundleItem[],
  countBest: number,
): number | null {
  const graded = items
    .filter((i) => i.grade.trim() !== "")
    .map((i) => parseFloat(i.grade))
    .filter((g) => !isNaN(g));
  if (graded.length === 0) return null;
  const n = Math.min(countBest, graded.length);
  const topN = [...graded].sort((a, b) => b - a).slice(0, n);
  return topN.reduce((s, g) => s + g, 0) / topN.length;
}

function getEffectiveWeight(row: Row, scheme: CalcScheme | null): number {
  if (scheme && row.id in scheme.weights)
    return parseFloat(scheme.weights[row.id]) || 0;
  return parseFloat(row.weight) || 0;
}

function computeSummary(rows: Row[], scheme: CalcScheme | null) {
  let gradePortionSum = 0;
  let worthSum = 0;
  let gradedWorthSum = 0;
  for (const row of rows) {
    const w = getEffectiveWeight(row, scheme);
    worthSum += w;
    if (row.type === "single") {
      if (row.grade.trim() !== "") {
        const g = parseFloat(row.grade);
        if (!isNaN(g)) {
          gradePortionSum += g * w * 0.01;
          gradedWorthSum += w;
        }
      }
    } else {
      const g = computeBundleGrade(row.items, row.countBest);
      if (g !== null) {
        gradePortionSum += g * w * 0.01;
        gradedWorthSum += w;
      }
    }
  }
  const calculatedGrade =
    gradedWorthSum === 0 ? null : (gradePortionSum / gradedWorthSum) * 100;
  return { calculatedGrade, gradePortionSum, worthSum, gradedWorthSum };
}

//  Component

const DEFAULT_ROW: SingleRow = {
  id: "1",
  type: "single",
  name: "",
  weight: "",
  grade: "",
};

export default function HomeScreen() {
  const saved = readCookie();
  const [rows, setRows] = useState<Row[]>(saved?.rows ?? [DEFAULT_ROW]);
  const [desiredGrade, setDesiredGrade] = useState(saved?.desiredGrade ?? "");
  const [schemes, setSchemes] = useState<CalcScheme[]>(saved?.schemes ?? []);
  const [activeSchemeIdx, setActiveSchemeIdx] = useState(0);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [expandedBundles, setExpandedBundles] = useState<
    Record<string, boolean>
  >({});
  const [bundleDrafts, setBundleDrafts] =
    useState<Record<string, { total?: string; countBest?: string }>>();
  const addButtonRef = useRef<any>(null);
  const [dropdownTop, setDropdownTop] = useState(56);

  useEffect(() => {
    writeCookie({ rows, desiredGrade, schemes });
  }, [rows, desiredGrade, schemes]);

  useEffect(() => {
    if (schemes.length > 0 && activeSchemeIdx >= schemes.length)
      setActiveSchemeIdx(schemes.length - 1);
  }, [schemes.length]);

  const activeScheme =
    schemes.length > 0 ? (schemes[activeSchemeIdx] ?? null) : null;

  const { calculatedGrade, gradePortionSum, worthSum, gradedWorthSum } =
    useMemo(() => computeSummary(rows, activeScheme), [rows, activeScheme]);

  const schemeGrades = useMemo(
    () => schemes.map((s) => computeSummary(rows, s).calculatedGrade),
    [schemes, rows],
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

  const requiredScore = useMemo((): number | null => {
    const desired = parseFloat(desiredGrade);
    if (isNaN(desired) || desired < 0 || desired > 100) return null;
    const remainingWeight = 100 - gradedWorthSum;
    if (remainingWeight <= 0) return null;
    return ((desired - gradePortionSum) / remainingWeight) * 100;
  }, [desiredGrade, gradePortionSum, gradedWorthSum]);

  //  Effective weight string for display/input

  const effectiveWeightStr = (row: Row): string => {
    if (activeScheme && row.id in activeScheme.weights)
      return activeScheme.weights[row.id];
    return row.weight;
  };

  //  Row mutations

  const addSingle = () => {
    setRows((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        type: "single",
        name: "",
        weight: "",
        grade: "",
      },
    ]);
  };

  const addBundle = () => {
    const newId = Date.now().toString();
    const items: BundleItem[] = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      grade: "",
    }));
    setRows((prev) => [
      ...prev,
      { id: newId, type: "bundle", name: "", weight: "", countBest: 5, items },
    ]);
    setExpandedBundles((prev) => ({ ...prev, [newId]: true }));
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setSchemes((prev) =>
      prev.map((s) => {
        const w = { ...s.weights };
        delete w[id];
        return { ...s, weights: w };
      }),
    );
  };

  const updateWeight = (id: string, value: string) => {
    if (activeScheme) {
      setSchemes((prev) =>
        prev.map((s) =>
          s.id === activeScheme.id
            ? { ...s, weights: { ...s.weights, [id]: value } }
            : s,
        ),
      );
    } else {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, weight: value } : r)),
      );
    }
  };

  const updateSingleField = (
    id: string,
    field: "name" | "grade",
    value: string,
  ) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  };

  const updateBundleField = (
    id: string,
    field: "name" | "countBest" | "total",
    value: string,
  ) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id || r.type !== "bundle") return r;
        if (field === "name") return { ...r, name: value };
        if (field === "countBest") {
          const dropped = parseInt(value, 10);
          if (isNaN(dropped) || dropped < 0) return r;
          return { ...r, countBest: Math.max(1, r.items.length - dropped) };
        }
        if (field === "total") {
          const newTotal = parseInt(value, 10);
          if (isNaN(newTotal) || newTotal < 1 || newTotal > 50) return r;
          let items = [...r.items];
          if (newTotal > items.length) {
            items = [
              ...items,
              ...Array.from({ length: newTotal - items.length }, (_, i) => ({
                id: String(items.length + i),
                grade: "",
              })),
            ];
          } else {
            items = items.slice(0, newTotal);
          }
          return {
            ...r,
            items,
            countBest: Math.max(1, newTotal - (r.items.length - r.countBest)),
          };
        }
        return r;
      }),
    );
  };

  const updateBundleItemGrade = (
    rowId: string,
    itemIdx: number,
    grade: string,
  ) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId || r.type !== "bundle") return r;
        const newItems = r.items.map((item, i) =>
          i === itemIdx ? { ...item, grade } : item,
        );
        return { ...r, items: newItems };
      }),
    );
  };

  //  Scheme mutations

  const handleAddScheme = () => {
    const baseWeights: Record<string, string> = {};
    rows.forEach((r) => {
      baseWeights[r.id] = r.weight;
    });
    if (schemes.length === 0) {
      const id1 = Date.now().toString();
      const id2 = (Date.now() + 1).toString();
      setSchemes([
        { id: id1, name: "Scheme 1", weights: { ...baseWeights } },
        { id: id2, name: "Scheme 2", weights: { ...baseWeights } },
      ]);
      setActiveSchemeIdx(1);
    } else {
      const src = schemes[activeSchemeIdx] ?? schemes[schemes.length - 1];
      const newId = Date.now().toString();
      setSchemes((prev) => [
        ...prev,
        {
          id: newId,
          name: `Scheme ${prev.length + 1}`,
          weights: { ...src.weights },
        },
      ]);
      setActiveSchemeIdx(schemes.length);
    }
  };

  const handleDeleteScheme = (schemeId: string) => {
    setSchemes((prev) => prev.filter((s) => s.id !== schemeId));
  };

  //  Render

  return (
    <SafeAreaView style={styles.page}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.maxWidthContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Quick Calculator</Text>
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

          {/* Desired final grade */}
          {gradePortionSum > 0 && (
            <View style={styles.desiredCard}>
              <Text style={styles.desiredTitle}>Desired Final Grade</Text>
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
                    gradedWorthSum >= 100 ? (
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
            </View>
          )}

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
              <Text style={styles.summaryLabel}>Total Weight</Text>
              <Text
                style={[
                  styles.summaryValue,
                  { color: worthSum === 100 ? COLORS.success : COLORS.danger },
                ]}
              >
                {worthSum}%
              </Text>
            </View>
          </View>

          {/* Scheme tabs */}
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
                      onPress={() => handleDeleteScheme(scheme.id)}
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

          {/* Assessment rows */}
          {rows.map((row) => {
            const w = effectiveWeightStr(row);
            if (row.type === "bundle") {
              const expanded = expandedBundles[row.id] ?? false;
              const bundleGrade = computeBundleGrade(row.items, row.countBest);
              const gradedCount = row.items.filter(
                (i) => i.grade.trim() !== "",
              ).length;
              const droppedIndices = (() => {
                const dropCount = Math.max(0, row.items.length - row.countBest);
                if (dropCount === 0) return new Set<number>();
                const ungradedIdxs = row.items
                  .map((it, i) => i)
                  .filter(
                    (i) =>
                      row.items[i].grade.trim() === "" ||
                      isNaN(parseFloat(row.items[i].grade)),
                  );
                const dropped = new Set<number>();
                if (ungradedIdxs.length >= dropCount) {
                  // More ungraded than needed — show only the bottom dropCount as red
                  ungradedIdxs.slice(-dropCount).forEach((i) => dropped.add(i));
                } else {
                  // Drop all ungraded first, then fill with lowest-graded
                  ungradedIdxs.forEach((i) => dropped.add(i));
                  const remainingDrop = dropCount - ungradedIdxs.length;
                  if (remainingDrop > 0) {
                    const graded = row.items
                      .map((it, i) => ({ i, grade: parseFloat(it.grade) }))
                      .filter(({ grade }) => !isNaN(grade));
                    [...graded]
                      .sort((a, b) => a.grade - b.grade || b.i - a.i)
                      .slice(0, remainingDrop)
                      .forEach(({ i }) => dropped.add(i));
                  }
                }
                return dropped;
              })();
              return (
                <View key={row.id}>
                  <TouchableOpacity
                    style={[
                      styles.inputRowCard,
                      expanded
                        ? {
                            marginBottom: 0,
                            borderBottomLeftRadius: 0,
                            borderBottomRightRadius: 0,
                          }
                        : {},
                    ]}
                    onPress={() =>
                      setExpandedBundles((prev) => ({
                        ...prev,
                        [row.id]: !expanded,
                      }))
                    }
                    activeOpacity={0.7}
                  >
                    <AppTextInput
                      style={[styles.inputBox, styles.inputBoxName]}
                      placeholder="Assessment Name"
                      placeholderTextColor={COLORS.textDim}
                      value={row.name}
                      onChangeText={(v) => updateBundleField(row.id, "name", v)}
                    />
                    <View style={styles.bundleInfoArea}>
                      <Text style={styles.bundleChevron}>
                        {expanded ? "▲" : "▼"}
                      </Text>
                      {bundleGrade !== null ? (
                        <Text style={styles.bundleGradeText}>
                          {bundleGrade.toFixed(1)}%
                        </Text>
                      ) : (
                        <Text style={styles.bundlePendingText}>—</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => removeRow(row.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text
                        style={{ color: COLORS.danger, fontWeight: "bold" }}
                      >
                        ✕
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>

                  {expanded && (
                    <View style={styles.bundleItemsWrapper}>
                      <View style={styles.bundleConfigRow}>
                        <Text style={styles.bundleConfigLabel}>Weight %</Text>
                        <AppTextInput
                          style={styles.bundleConfigInput}
                          placeholder="0"
                          placeholderTextColor={COLORS.textDim}
                          keyboardType="decimal-pad"
                          value={w}
                          onChangeText={(v) => updateWeight(row.id, v)}
                        />
                        <Text style={styles.bundleConfigLabel}>Total</Text>
                        <AppTextInput
                          style={styles.bundleConfigInput}
                          placeholder="5"
                          placeholderTextColor={COLORS.textDim}
                          keyboardType="number-pad"
                          value={
                            bundleDrafts?.[row.id]?.total ??
                            String(row.items.length)
                          }
                          onChangeText={(v) =>
                            setBundleDrafts((prev) => ({
                              ...prev,
                              [row.id]: { ...prev?.[row.id], total: v },
                            }))
                          }
                          onBlur={() => {
                            const v = bundleDrafts?.[row.id]?.total;
                            if (v !== undefined) {
                              updateBundleField(row.id, "total", v);
                              setBundleDrafts((prev) => {
                                const d = { ...prev?.[row.id] };
                                delete d.total;
                                return { ...prev, [row.id]: d };
                              });
                            }
                          }}
                        />
                        <Text style={styles.bundleConfigLabel}>Dropped</Text>
                        <AppTextInput
                          style={styles.bundleConfigInput}
                          placeholder="0"
                          placeholderTextColor={COLORS.textDim}
                          keyboardType="number-pad"
                          value={
                            bundleDrafts?.[row.id]?.countBest ??
                            String(row.items.length - row.countBest)
                          }
                          onChangeText={(v) =>
                            setBundleDrafts((prev) => ({
                              ...prev,
                              [row.id]: { ...prev?.[row.id], countBest: v },
                            }))
                          }
                          onBlur={() => {
                            const v = bundleDrafts?.[row.id]?.countBest;
                            if (v !== undefined) {
                              updateBundleField(row.id, "countBest", v);
                              setBundleDrafts((prev) => {
                                const d = { ...prev?.[row.id] };
                                delete d.countBest;
                                return { ...prev, [row.id]: d };
                              });
                            }
                          }}
                        />
                      </View>
                      {row.items.map((item, idx) => (
                        <View
                          key={item.id}
                          style={[
                            styles.bundleItemRow,
                            droppedIndices.has(idx) && styles.bundleDroppedRow,
                          ]}
                        >
                          <Text
                            style={[
                              styles.bundleItemLabel,
                              droppedIndices.has(idx) && {
                                color: COLORS.danger,
                              },
                            ]}
                          >
                            Item {idx + 1}
                          </Text>
                          <AppTextInput
                            style={[
                              styles.bundleItemInput,
                              droppedIndices.has(idx) && {
                                borderColor: COLORS.danger,
                              },
                            ]}
                            placeholder="—"
                            placeholderTextColor={COLORS.textDim}
                            keyboardType="decimal-pad"
                            value={item.grade}
                            onChangeText={(v) =>
                              updateBundleItemGrade(row.id, idx, v)
                            }
                          />
                          <Text
                            style={[
                              styles.bundleItemPercent,
                              droppedIndices.has(idx) && {
                                color: COLORS.danger,
                              },
                            ]}
                          >
                            %
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            }

            return (
              <View key={row.id} style={styles.inputRowCard}>
                <AppTextInput
                  style={[styles.inputBox, styles.inputBoxName]}
                  placeholder="Name"
                  placeholderTextColor={COLORS.textDim}
                  value={row.name}
                  onChangeText={(v) => updateSingleField(row.id, "name", v)}
                />
                <AppTextInput
                  style={styles.inputBox}
                  placeholder="Weight %"
                  placeholderTextColor={COLORS.textDim}
                  keyboardType="decimal-pad"
                  value={w}
                  onChangeText={(v) => updateWeight(row.id, v)}
                />
                <AppTextInput
                  style={styles.inputBox}
                  placeholder="Grade %"
                  placeholderTextColor={COLORS.textDim}
                  keyboardType="decimal-pad"
                  value={row.grade}
                  onChangeText={(v) => updateSingleField(row.id, "grade", v)}
                />
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => removeRow(row.id)}
                >
                  <Text style={{ color: COLORS.danger, fontWeight: "bold" }}>
                    ✕
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Add dropdown */}
      {addMenuOpen && (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setAddMenuOpen(false)}
        >
          <View style={StyleSheet.absoluteFillObject}>
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              onPress={() => setAddMenuOpen(false)}
              activeOpacity={1}
            />
            <View style={[styles.addDropdown, { top: dropdownTop, right: 20 }]}>
              <TouchableOpacity
                style={styles.addDropdownItem}
                onPress={() => {
                  setAddMenuOpen(false);
                  addSingle();
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
                  addBundle();
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
      )}
    </SafeAreaView>
  );
}

//  Styles

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: Platform.OS === "web" ? 40 : 0,
  },
  scrollContent: { flexGrow: 1 },
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
    paddingTop: 24,
    marginBottom: 18,
  },
  title: { color: COLORS.textMain, fontSize: 20, fontWeight: "700" },
  addButton: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  addButtonText: { color: COLORS.accent, fontSize: 14, fontWeight: "700" },
  desiredCard: {
    marginBottom: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 16,
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
  desiredPercent: { color: COLORS.textDim, fontSize: 16, fontWeight: "600" },
  desiredResultBox: { flex: 1, marginLeft: 8, justifyContent: "center" },
  desiredHint: { color: COLORS.textDim, fontSize: 13, fontStyle: "italic" },
  desiredResultInner: { gap: 2 },
  desiredResultLabel: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  desiredResultValue: { fontSize: 18, fontWeight: "800" },
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
  summaryItem: { flex: 1, alignItems: "center" },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
    marginHorizontal: 8,
  },
  summaryLabel: { color: COLORS.textDim, fontSize: 12, marginBottom: 4 },
  summaryValue: { fontSize: 18, fontWeight: "800" },
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
  weightWarningClose: { padding: 2 },
  weightWarningCloseText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: "700",
  },
  schemeTabs: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
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
  schemeTabActive: {
    borderColor: COLORS.accent,
    backgroundColor: "rgba(167, 139, 250, 0.15)",
  },
  schemeTabText: { color: COLORS.textDim, fontSize: 13, fontWeight: "600" },
  schemeTabTextActive: { color: COLORS.accent },
  schemeTabDelete: { opacity: 0.5 },
  schemeTabDeleteText: {
    color: COLORS.textDim,
    fontSize: 10,
    fontWeight: "700",
  },
  schemeTabDeleteTextActive: { color: COLORS.accent, opacity: 1 },
  inputRowCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    flexDirection: "row",
    padding: 12,
    gap: 8,
    marginBottom: 10,
    alignItems: "center",
  },
  inputBox: {
    flex: 1,
    height: 42,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 10,
    color: COLORS.textMain,
    textAlign: "center",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  inputBoxName: { flex: 1.5 },
  deleteButton: {
    padding: 8,
    borderRadius: 10,
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  addDropdown: {
    position: "absolute",
    backgroundColor: "#0f172a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 220,
    zIndex: 1000,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0 8px 32px rgba(0,0,0,0.55)" } as any)
      : {}),
  },
  addDropdownItem: { paddingHorizontal: 18, paddingVertical: 14 },
  addDropdownItemText: {
    color: COLORS.textMain,
    fontSize: 14,
    fontWeight: "600",
  },
  addDropdownDivider: { height: 1, backgroundColor: COLORS.border },
  bundleCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    overflow: "hidden",
  },
  bundleInner: {
    flex: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  bundleLeft: { flex: 1 },
  bundleInfoArea: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bundleNameInput: {
    color: COLORS.textMain,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 2,
  },
  bundleSubtitle: { color: COLORS.textDim, fontSize: 12 },
  bundleRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bundleChevron: { color: COLORS.textDim, fontSize: 11, marginRight: 2 },
  bundleGradeText: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: "800",
    minWidth: 52,
    textAlign: "right",
  },
  bundlePendingText: {
    color: COLORS.textDim,
    fontSize: 16,
    fontWeight: "600",
    minWidth: 52,
    textAlign: "right",
  },
  bundleItemsWrapper: {
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
  bundleConfigRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  bundleConfigLabel: { color: COLORS.textDim, fontSize: 12 },
  bundleConfigInput: {
    backgroundColor: COLORS.inputBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: COLORS.textMain,
    fontSize: 13,
    width: 52,
    textAlign: "center",
  },
  bundleItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  bundleDroppedRow: {
    backgroundColor: "rgba(248, 113, 113, 0.08)",
  },
  bundleItemLabel: { color: COLORS.textDim, fontSize: 13, flex: 1 },
  bundleItemInput: {
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
  bundleItemPercent: { color: COLORS.textDim, fontSize: 13, width: 14 },
});
