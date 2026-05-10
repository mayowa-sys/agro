import { useAuth } from '@/stores/auth.store';
import { api } from '@/lib/api';
import { LanguageCode } from '@/i18n/labourer';

export function useLanguage() {
  const user = useAuth((s) => s.user);
  const token = useAuth((s) => s.token);
  const login = useAuth((s) => s.login);
  const lang = (user?.language as LanguageCode) || 'EN';

  const setLanguage = async (code: LanguageCode) => {
    if (!user || !token) return;
    const updatedUser = { ...user, language: code };
    // Update local store immediately (optimistic)
    login(token, updatedUser);
    // Try API — if it fails, no rollback needed for demo
    try {
      await api.patch('/labourers/me', { language: code });
    } catch {
      // silent
    }
  };

  return { language: lang, setLanguage };
}
