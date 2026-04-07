import { useMemo } from 'react';
import { useAuthContext } from '../components/AuthContext';
import { resolveFeatureFlags } from '../config/features';
import { getSocietyRuntimeContext } from '../config/firestore';

export function useFeatureFlags(overrides) {
  const { user } = useAuthContext();
  const runtime = getSocietyRuntimeContext(user);

  return useMemo(
    () => resolveFeatureFlags({ ...runtime, overrides }),
    [runtime.cityId, runtime.societyId, runtime.language, runtime.societySettings, overrides],
  );
}