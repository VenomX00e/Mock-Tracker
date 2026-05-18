import useSWR from 'swr';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';

async function fetchChallengesData(args: any) {
  const [_, uid, canManageChallenges, isOwner] = args;
  const chalSnap = await getDocs(query(collection(db, 'challenges')));
  let activeChallenges: any[] = [];
  let delChallenges: any[] = [];
  
  chalSnap.forEach(d => {
    const data = d.data();
    const isDeletedByCreator = data.deletedByCreator === true;
    const isPermanentlyDeletedByCreator = data.permanentlyDeletedByCreator === true;
    const isDeletedByAdmin = data.deletedByAdmin === true;
    const isPermanentlyDeletedByAdmin = data.permanentlyDeletedByAdmin === true;

    if (data.status === 'active' || data.status === undefined) {
       if (data.creatorId === uid) {
          if (isPermanentlyDeletedByCreator) return;
          if (isDeletedByCreator) {
              delChallenges.push({ id: d.id, ...data });
              return;
          }
       } else {
          if (canManageChallenges) {
             if (isPermanentlyDeletedByAdmin) return;
             if (isDeletedByAdmin) {
                 delChallenges.push({ id: d.id, ...data });
                 return;
             }
          } else {
             if (isDeletedByAdmin || isPermanentlyDeletedByAdmin) return;
          }

          if (data.visibility === 'personal' && data.creatorId !== uid) return;
          if (data.visibility === 'global') {
            if (data.endDate && data.endDate < new Date().toISOString().split('T')[0]) {
              if (!isOwner) return;
            }
            if (data.approvalStatus === 'pending') {
              if (data.creatorId !== uid && !canManageChallenges) return;
            } else if (data.approvalStatus === 'rejected') {
              if (data.creatorId !== uid) return;
            }
          }
       }
       activeChallenges.push({ id: d.id, ...data });
    } else if (data.status === 'deleted') {
       if (data.creatorId === uid && !isPermanentlyDeletedByCreator) {
         delChallenges.push({ id: d.id, ...data });
       } else if (canManageChallenges && data.creatorId !== uid && !isPermanentlyDeletedByAdmin) {
         delChallenges.push({ id: d.id, ...data });
       }
    }
  });

  return { activeChallenges, delChallenges };
}

export function useChallengesQuery(user: any, adminPermissions: any, isOwner?: boolean) {
  const { data, error, mutate } = useSWR(
    user ? ['challenges', user.uid, adminPermissions?.canManageChallenges, isOwner] : null,
    fetchChallengesData,
    { revalidateOnFocus: false }
  );

  return {
    challenges: data?.activeChallenges || [],
    deletedChallenges: data?.delChallenges || [],
    loading: !data && !error && !!user,
    error,
    mutate
  };
}
