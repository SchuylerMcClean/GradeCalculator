import React, { PropsWithChildren, useState } from "react";
import { Image } from "expo-image";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  Button,
  useWindowDimensions,
} from "react-native";

import ListView from "@/components/parallax-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Link } from "expo-router";

const InputRow = ({
  grade,
  worth,
  onChangeGrade,
  onChangeWorth,
  gradePortion,
  onDelete,
}: {
  grade: string;
  worth: string;
  gradePortion: number;
  onChangeGrade: (g: string) => void;
  onChangeWorth: (w: string) => void;
  onDelete: () => void;
}) => {
  return (
    <View style={styles.inputGradeContainer}>
      <View style={styles.rightInputContainer}>
        <TextInput
          style={styles.inputBox}
          value={grade}
          onChangeText={(newGrade) => {
            onChangeGrade(newGrade);
          }}
        />
      </View>
      <View style={styles.leftInputContainer}>
        <TextInput
          style={styles.inputBox}
          value={worth}
          onChangeText={(newWorth) => {
            onChangeWorth(newWorth);
          }}
        />
        <Button title="X" onPress={onDelete} />
      </View>
    </View>
  );
};

const WorthStatement = ({
  gradePortionSum,
  worthSum,
  gradeGoal,
  onChangeGoal,
}: {
  gradePortionSum: number;
  worthSum: number;
  gradeGoal: string;
  onChangeGoal: (goal: string) => void;
}) => {
  const remainder = 100 - worthSum;
  const remainderGrade =
    ((Number(gradeGoal) - gradePortionSum) / remainder) * 100;

  if (worthSum === 0 || worthSum === 100) {
    return;
  }

  if (worthSum > 100) {
    return (
      <Text style={styles.invalidWorth}>
        Caution: Grade is calculated based on a worth of {worthSum}%
      </Text>
    );
  }

  return (
    <View>
      <View style={styles.remainder}>
        <Text style={styles.validWorth}>Final Grade Goal:</Text>
        <TextInput
          style={styles.inputBox}
          value={gradeGoal}
          onChangeText={(newGoal) => {
            onChangeGoal(newGoal);
          }}
        />
      </View>
      {gradeGoal === "" ? null : remainderGrade <= 100 ? (
        <Text style={styles.validWorth}>
          You need {remainderGrade.toFixed(1)}% on remaining {remainder}% to
          achieve the final grade {gradeGoal}%.
        </Text>
      ) : (
        <Text style={[styles.validWorth, { color: "red" }]}>
          It is impossible to receive a final grade of {gradeGoal}%
        </Text>
      )}
    </View>
  );
};

interface RowData {
  id: string;
  grade: string;
  worth: string;
  gradePortion: number;
}

const ColumnTitles = () => {
  return (
    <ThemedView style={styles.columnTitleBox}>
      <Text style={styles.columnTitle}>Grade</Text>
      <Text style={styles.columnTitle}>Worth (%)</Text>
    </ThemedView>
  );
};

export default function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const [rows, setRows] = useState<RowData[]>([
    { id: "1", grade: "", worth: "", gradePortion: 0 },
  ]);

  const addRow = () => {
    const newId = (Date.now() + Math.random()).toString();
    setRows((prev) => [
      ...prev,
      { id: newId, grade: "", worth: "", gradePortion: 0 },
    ]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
  };

  const updateRow = (id: string, field: "grade" | "worth", value: string) => {
    setRows((prev) => {
      const updated = prev.map((row) =>
        row.id === id ? { ...row, [field]: value } : row
      );

      const r = updated.find((r) => r.id === id)!;
      const g = Number(r.grade) || 0;
      const w = Number(r.worth) || 0;
      r.gradePortion = g * w * 0.01;

      return [...updated];
    });
  };

  const gradePortionSum = rows.reduce((sum, r) => sum + r.gradePortion, 0);
  const worthSum = rows.reduce((sum, r) => sum + Number(r.worth), 0);
  const total = worthSum === 0 ? 0 : (gradePortionSum / worthSum) * 100;

  const [gradeGoal, setGradeGoal] = useState("");

  return (
    <ThemedView style={[styles.page, { height: height }]}>
      <ThemedView style={styles.toppage}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">Calculate Your Grade!</ThemedText>
        </ThemedView>

        <ThemedView style={styles.stepContainer}>
          <ColumnTitles />

          {rows.map((row) => (
            <InputRow
              key={row.id}
              grade={row.grade}
              worth={row.worth}
              gradePortion={row.gradePortion}
              onChangeGrade={(g) => updateRow(row.id, "grade", g)}
              onChangeWorth={(w) => updateRow(row.id, "worth", w)}
              onDelete={() => removeRow(row.id)}
            />
          ))}

          <Button title="Add Row" onPress={addRow} />
        </ThemedView>
      </ThemedView>
      <View style={styles.bottompage}>
        <ThemedView style={styles.statementsContainer}>
          <Text style={styles.textResult}>
            Your current grade is: {total.toFixed(1)}%
          </Text>
          <WorthStatement
            gradePortionSum={gradePortionSum}
            worthSum={worthSum}
            gradeGoal={gradeGoal}
            onChangeGoal={(newGoal) => {
              setGradeGoal(newGoal);
            }}
          />
        </ThemedView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  page: {
    alignContent: "center",
    height: "100%",
  },
  toppage: {
    flex: 8,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 30,
  },
  bottompage: {
    flex: 2,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingBottom: 30,
  },
  statementsContainer: {
    justifyContent: "flex-start",
  },
  titleContainer: {
    width: "100%",
    alignItems: "center",
    gap: 8,
    padding: 20,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  inputGradeContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 15,
  },
  inputBox: {
    height: 60,
    width: 85,
    padding: 5,
    borderWidth: 1,
    borderRadius: 10,
    borderColor: "white",
    color: "white",
    alignSelf: "center",
    justifyContent: "center",
    fontSize: 22,
    textAlign: "center",
  },
  columnTitleBox: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  columnTitle: {
    fontSize: 25,
    width: 120,
    alignSelf: "center",
    textAlign: "center",
    color: "white",
  },
  textResult: {
    color: "lightgreen",
    alignSelf: "center",
    fontSize: 28,
  },
  textTesting: {
    color: "white",
  },
  validWorth: {
    color: "white",
    alignSelf: "center",
    fontSize: 20,
    paddingLeft: 40,
    paddingRight: 40,
    alignContent: "center",
  },
  invalidWorth: {
    color: "red",
    alignSelf: "center",
    fontSize: 24,
  },
  remainder: {
    width: "100%",
    color: "white",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 20,
  },
  rightInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    gap: 10,
  },
  leftInputContainer: {
    justifyContent: "center",
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
