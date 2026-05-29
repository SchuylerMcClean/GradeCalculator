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

export interface BundleItem {
  id: string;
  grade: number | null;
}

export interface Assessment {
  id: string;
  name: string;
  weight: number; // 0–100
  grade: number | null; // 0–100, null = not yet graded (always null for bundles)
  order: number; // display order, 0-indexed
  type?: "single" | "bundle"; // undefined treated as "single" for backwards compat
  countBest?: number; // bundle only: top N grades count toward the final score
  items?: BundleItem[]; // bundle only: individual sub-item grades
}

// ─── Courses ──────────────────────────────────────────────────────────────────

/** Subscribe to the courses collection in real time. Returns an unsubscribe fn. */
export function subscribeToCourses(
  uid: string,
  callback: (courses: Course[]) => void,
): () => void {
  const q = collection(db, "users", uid, "courses");
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

export async function addCourse(
  uid: string,
  data: Omit<Course, "id">,
): Promise<string> {
  const ref = await addDoc(collection(db, "users", uid, "courses"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateCourse(
  uid: string,
  courseId: string,
  data: Partial<Omit<Course, "id">>,
): Promise<void> {
  await updateDoc(
    doc(db, "users", uid, "courses", courseId),
    data as Record<string, unknown>,
  );
}

export async function deleteCourse(
  uid: string,
  courseId: string,
): Promise<void> {
  // Delete all assessments in the subcollection first
  const assessmentsRef = collection(
    db,
    "users",
    uid,
    "courses",
    courseId,
    "assessments",
  );
  const snapshot = await getDocs(assessmentsRef);
  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "users", uid, "courses", courseId));
  await batch.commit();
}

export async function batchUpdateCourseOrders(
  uid: string,
  updates: { id: string; order: number }[],
): Promise<void> {
  const batch = writeBatch(db);
  for (const { id, order } of updates) {
    batch.update(doc(db, "users", uid, "courses", id), { order });
  }
  await batch.commit();
}

export async function initCourseOrder(
  uid: string,
  courses: Course[],
): Promise<void> {
  const needsOrder = courses.filter(
    (c) => c.order === undefined || c.order === null,
  );
  if (needsOrder.length === 0) return;
  const batch = writeBatch(db);
  courses.forEach((c, i) => {
    if (c.order === undefined || c.order === null) {
      batch.update(doc(db, "users", uid, "courses", c.id), { order: i });
    }
  });
  await batch.commit();
}

// ─── Assessments ──────────────────────────────────────────────────────────────

/** Subscribe to a course's assessments subcollection in real time. */
export function subscribeToAssessments(
  uid: string,
  courseId: string,
  callback: (assessments: Assessment[]) => void,
): () => void {
  const q = query(
    collection(db, "users", uid, "courses", courseId, "assessments"),
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
  uid: string,
  courseId: string,
  data: Omit<Assessment, "id">,
): Promise<string> {
  const ref = await addDoc(
    collection(db, "users", uid, "courses", courseId, "assessments"),
    {
      ...data,
      createdAt: serverTimestamp(),
    },
  );
  return ref.id;
}

/**
 * Swap the `order` values of two assessments in a single batch write.
 * Used to move an assessment up or down in the list.
 */
export async function swapAssessmentOrder(
  uid: string,
  courseId: string,
  aId: string,
  aOrder: number,
  bId: string,
  bOrder: number,
): Promise<void> {
  const batch = writeBatch(db);
  batch.update(doc(db, "users", uid, "courses", courseId, "assessments", aId), {
    order: bOrder,
  });
  batch.update(doc(db, "users", uid, "courses", courseId, "assessments", bId), {
    order: aOrder,
  });
  await batch.commit();
}

/**
 * Assign sequential `order` values to all assessments that are missing the field.
 * Call once on first load as a migration step.
 */
export async function initAssessmentOrder(
  uid: string,
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
      batch.update(
        doc(db, "users", uid, "courses", courseId, "assessments", a.id),
        { order: i },
      );
    }
  });
  await batch.commit();
}

/**
 * Batch-update the `order` field on multiple assessments at once.
 * Used after a drag-and-drop reorder to persist the new sequence.
 */
export async function batchUpdateOrders(
  uid: string,
  courseId: string,
  updates: { id: string; order: number }[],
): Promise<void> {
  const batch = writeBatch(db);
  for (const { id, order } of updates) {
    batch.update(
      doc(db, "users", uid, "courses", courseId, "assessments", id),
      { order },
    );
  }
  await batch.commit();
}

export async function updateAssessment(
  uid: string,
  courseId: string,
  assessmentId: string,
  data: Partial<Omit<Assessment, "id">>,
): Promise<void> {
  await updateDoc(
    doc(db, "users", uid, "courses", courseId, "assessments", assessmentId),
    data as Record<string, unknown>,
  );
}

export async function deleteAssessment(
  uid: string,
  courseId: string,
  assessmentId: string,
): Promise<void> {
  await deleteDoc(
    doc(db, "users", uid, "courses", courseId, "assessments", assessmentId),
  );
}
