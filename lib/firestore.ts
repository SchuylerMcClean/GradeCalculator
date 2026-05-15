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
}

export interface Assessment {
  id: string;
  name: string;
  weight: number; // 0–100
  score: number | null; // 0–100, null = not yet graded
}

// ─── Courses ──────────────────────────────────────────────────────────────────

/** Subscribe to the courses collection in real time. Returns an unsubscribe fn. */
export function subscribeToCourses(
  callback: (courses: Course[]) => void,
): () => void {
  const q = query(collection(db, "courses"), orderBy("name"));
  return onSnapshot(q, (snapshot) => {
    const courses: Course[] = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...(docSnap.data() as Omit<Course, "id">),
    }));
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

// ─── Assessments ──────────────────────────────────────────────────────────────

/** Subscribe to a course's assessments subcollection in real time. */
export function subscribeToAssessments(
  courseId: string,
  callback: (assessments: Assessment[]) => void,
): () => void {
  const q = query(
    collection(db, "courses", courseId, "assessments"),
    orderBy("createdAt"),
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
