import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../services/AuthContext';
import { MockScore } from '../types';

export function useMocks() {
  const { user } = useAuth();
  const [mocks, setMocks] = useState<MockScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setMocks([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'users', user.uid, 'mocks'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const mockData: MockScore[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as any;
        mockData.push({
          ...data,
          id: doc.id,
        } as MockScore);
      });
      setMocks(mockData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching mocks:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const addMock = async (mock: MockScore) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'mocks', mock.id);
      await setDoc(docRef, {
        ...mock,
        userId: user.uid,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error adding mock:", error);
    }
  };

  const updateMock = async (updatedMock: MockScore) => {
    if (!user) return;
    try {
      const docRef = doc(db, 'users', user.uid, 'mocks', updatedMock.id);
      // Retrieve old createdAt
      const oldItem = mocks.find(m => m.id === updatedMock.id);
      await setDoc(docRef, {
        ...updatedMock,
        userId: user.uid,
        createdAt: oldItem?.createdAt || serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error("Error updating mock:", error);
    }
  };
  
  const deleteMock = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'mocks', id));
    } catch (error) {
      console.error("Error deleting mock:", error);
    }
  };

  return { mocks, loading, addMock, updateMock, deleteMock };
}
