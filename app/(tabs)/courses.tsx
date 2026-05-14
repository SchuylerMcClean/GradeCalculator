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

import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// Define the Course type
interface Course {
  id: string;
  name: string;
  instructor?: string;
  grade?: number;
  credits?: number;
  semester?: string;
  status: "active" | "completed" | "planned";
}

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Fetch courses from database
  const fetchCourses = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual database call
      // Example: const response = await api.get('/courses');
      // const data = await response.json();

      // Mock data for demonstration
      const mockCourses: Course[] = [
        {
          id: "1",
          name: "Mathematics 101",
          instructor: "Dr. Smith",
          grade: 85.5,
          status: "active",
        },
        {
          id: "2",
          name: "Physics",
          instructor: "Prof. Johnson",
          grade: 92.0,
          status: "active",
        },
        {
          id: "3",
          name: "Computer Science",
          instructor: "Dr. Williams",
          grade: 78.5,
          status: "completed",
        },
        {
          id: "4",
          name: "English Literature",
          instructor: "Prof. Davis",
          status: "planned",
        },
      ];

      setCourses(mockCourses);
    } catch (error) {
      console.error("Error fetching courses:", error);
      Alert.alert("Error", "Failed to load courses. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCourses();
  };

  const handleCoursePress = (course: Course) => {
    router.push({
      pathname: "/course/[id]" as any,
      params: { id: course.id, name: course.name },
    });
  };

  const getStatusColor = (status: Course["status"]) => {
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

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading your courses...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Courses</Text>
        <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={courses}
        renderItem={renderCourseCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={renderEmptyState}
      />
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
});
