import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CourseStatus = "active" | "completed" | "planned";

export interface Course {
  id: string;
  name: string;
  instructor?: string;
  grade?: number; // computed weighted average, written back after assessment changes
  status: CourseStatus;
  order?: number; // display order, 0-indexed
}

export interface Assessment {
  id: string;
  name: string;
  weight: number; // 0–100
  score: number | null; // 0–100, null = not yet graded
  order: number; // display order, 0-indexed
}

// ─── Courses ──────────────────────────────────────────────────────────────────

/** Subscribe to the courses collection in real time. Returns an unsubscribe fn. */
export function subscribeToCourses(
  callback: (courses: Course[]) => void,
): () => void {
  const q = collection(db, "courses");
  return onSnapshot(q, (snapshot) => {
    const courses: Course[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Course, "id">),
    }));
    courses.sort((a, b) => {
      if (a.order !== undefined && b.order !== undefined)
        return a.order - b.order;
      if (a.order !== undefined) return -1;
      if (b.order !== undefined) return 1;
      return a.name.localeCompare(b.name);
    });
    callback(courses);
  });
}

export async function addCourse(data: Omit<Course, "id">): Promise<string> {
  const ref = await addDoc(collection(db, "courses"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCourse(
  courseId: string,
  data: Partial<Omit<Course, "id">>,
): Promise<void> {
  await updateDoc(
    doc(db, "courses", courseId),
    data as Record<string, unknown>,
  );
}

export async function deleteCourse(courseId: string): Promise<void> {
  // Delete all assessments in the subcollection first
  const assessmentsRef = collection(db, "courses", courseId, "assessments");
  const snapshot = await getDocs(assessmentsRef);
  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "courses", courseId));
  await batch.commit();
}

export async function batchUpdateCourseOrders(
  updates: { id: string; order: number }[],
): Promise<void> {
  const batch = writeBatch(db);
  for (const { id, order } of updates) {
    batch.update(doc(db, "courses", id), { order });
  }
  await batch.commit();
}

export async function initCourseOrder(courses: Course[]): Promise<void> {
  const needsOrder = courses.filter(
    (c) => c.order === undefined || c.order === null,
  );
  if (needsOrder.length === 0) return;
  const batch = writeBatch(db);
  courses.forEach((c, i) => {
    if (c.order === undefined || c.order === null) {
      batch.update(doc(db, "courses", c.id), { order: i });
    }
  });
  await batch.commit();
}

// ─── Assessments ──────────────────────────────────────────────────────────────

/** Subscribe to a course's assessments subcollection in real time. */
export function subscribeToAssessments(
  courseId: string,
  callback: (assessments: Assessment[]) => void,
): () => void {
  const q = query(
    collection(db, "courses", courseId, "assessments"),
    orderBy("order"),
  );
  return onSnapshot(q, (snapshot) => {
    const assessments: Assessment[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Assessment, "id">),
    }));
    callback(assessments);
  });
}

export async function addAssessment(
  courseId: string,
  data: Omit<Assessment, "id">,
): Promise<string> {
  const ref = await addDoc(collection(db, "courses", courseId, "assessments"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Swap the `order` values of two assessments in a single batch write.
 * Used to move an assessment up or down in the list.
 */
export async function swapAssessmentOrder(
  courseId: string,
  aId: string,
  aOrder: number,
  bId: string,
  bOrder: number,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "courses", courseId, "assessments", aId), {
    order: bOrder,
  });
  batch.update(doc(db, "courses", courseId, "assessments", bId), {
    order: aOrder,
  });
  await batch.commit();
}

/**
 * Assign sequential `order` values to all assessments that are missing the field.
 * Call once on first load as a migration step.
 */
export async function initAssessmentOrder(
  courseId: string,
  assessments: Assessment[],
): Promise<void> {
  const needsOrder = assessments.filter(
    (a) => a.order === undefined || a.order === null,
  );
  if (needsOrder.length === 0) return;
  const batch = writeBatch(db);
  assessments.forEach((a, i) => {
    if (a.order === undefined || a.order === null) {
      batch.update(doc(db, "courses", courseId, "assessments", a.id), {
        order: i,
      });
    }
  });
  await batch.commit();
}

/**
 * Batch-update the `order` field on multiple assessments at once.
 * Used after a drag-and-drop reorder to persist the new sequence.
 */
export async function batchUpdateOrders(
  courseId: string,
  updates: { id: string; order: number }[],
): Promise<void> {
  const batch = writeBatch(db);
  for (const { id, order } of updates) {
    batch.update(doc(db, "courses", courseId, "assessments", id), { order });
  }
  await batch.commit();
}

export async function updateAssessment(
  courseId: string,
  assessmentId: string,
  data: Partial<Omit<Assessment, "id">>,
): Promise<void> {
  await updateDoc(
    doc(db, "courses", courseId, "assessments", assessmentId),
    data as Record<string, unknown>,
  );
}

export async function deleteAssessment(
  courseId: string,
  assessmentId: string,
): Promise<void> {
  await deleteDoc(doc(db, "courses", courseId, "assessments", assessmentId));
}
