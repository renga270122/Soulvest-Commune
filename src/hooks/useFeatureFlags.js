import { useAuthContext } from '../components/auth-context';
import { resolveFeatureFlags } from '../config/features';
import { getSocietyRuntimeContext } from '../config/firestore';

export function useFeatureFlags(overrides) {
  const { user } = useAuthContext();
  const runtime = getSocietyRuntimeContext(user);

  return resolveFeatureFlags({ ...runtime, overrides });
}