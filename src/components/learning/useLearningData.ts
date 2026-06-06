import { useState, useEffect } from 'react';
import { fetchCourses } from '../../services/learningFirebaseService';

export interface LearningSubject {
  id: string;
  title: string;
  description: string;
  modulesCount: number;
  progress: number;
}

export function useLearningData() {
  const [subjects, setSubjects] = useState<LearningSubject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchLearningData = async () => {
      setLoading(true);
      try {
        const courses = await fetchCourses();
        if (isMounted) {
          setSubjects(courses.map(course => ({
            id: course.id,
            title: course.title,
            description: course.description,
            modulesCount: course.modulesCount || 0,
            progress: 0 // Progress fetching can be added later
          })));
        }
      } catch (error) {
        console.error('Failed to load learning data:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchLearningData();

    return () => {
      isMounted = false;
    };
  }, []);

  return { subjects, loading };
}
