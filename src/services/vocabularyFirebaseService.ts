import { db } from "./firebase";
import { collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import type { EditorialCanvas } from "../store/vocabularyStore";

const CANVASES_COLLECTION = "editorial_canvases";

export function subscribeToCanvases(callback: (canvases: EditorialCanvas[]) => void) {
  const q = query(collection(db, CANVASES_COLLECTION), orderBy("date", "desc"));
  return onSnapshot(q, (snapshot) => {
    const canvases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EditorialCanvas));
    callback(canvases);
  }, (error) => {
    console.error("Error subscribing to canvases:", error);
  });
}

export async function saveCanvasToFirestore(canvas: EditorialCanvas) {
  try {
    const canvasRef = doc(db, CANVASES_COLLECTION, canvas.id);
    await setDoc(canvasRef, canvas);
  } catch (error) {
    console.error("Error saving canvas:", error);
  }
}

export async function deleteCanvasFromFirestore(id: string) {
  try {
    const canvasRef = doc(db, CANVASES_COLLECTION, id);
    await deleteDoc(canvasRef);
  } catch (error) {
    console.error("Error deleting canvas:", error);
  }
}
