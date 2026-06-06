import { db, auth } from "./firebase";
import { collection, doc, getDoc, getDocs, setDoc, query, where, orderBy, deleteDoc } from "firebase/firestore";
import type { LearningCourse, LearningModuleModel, LearningUserProgress } from "../types";

const COURSES_COLLECTION = "learning_courses";
const MODULES_COLLECTION = "learning_modules";
const PROGRESS_COLLECTION = "learning_progress";

// Isolated Firebase service for Learning to avoid polluting core collections

export async function fetchCourses(): Promise<LearningCourse[]> {
  try {
    const q = query(collection(db, COURSES_COLLECTION), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LearningCourse));
  } catch (error) {
    console.error("Error fetching courses:", error);
    return [];
  }
}

export async function fetchCourseModules(courseId: string): Promise<LearningModuleModel[]> {
  try {
    const q = query(collection(db, MODULES_COLLECTION), where("courseId", "==", courseId), orderBy("order", "asc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LearningModuleModel));
  } catch (error) {
    console.error("Error fetching course modules:", error);
    return [];
  }
}

export async function saveCourseProgress(courseId: string, completedModuleIds: string[], progressPercentage: number): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) return;

  try {
    const progressRef = doc(db, PROGRESS_COLLECTION, `${userId}_${courseId}`);
    const data: Partial<LearningUserProgress> = {
      userId,
      courseId,
      completedModuleIds,
      progressPercentage,
      lastAccessed: new Date(),
    };
    await setDoc(progressRef, data, { merge: true });
  } catch (error) {
    console.error("Error saving progress:", error);
  }
}
