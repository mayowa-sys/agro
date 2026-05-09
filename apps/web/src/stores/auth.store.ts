import { create } from 'zustand';

export interface User {
  id: string;
  phone: string;
  role: 'FARMER' | 'AGGREGATOR' | 'ADMIN';
  language: 'EN' | 'PIDGIN' | 'HAUSA' | 'YORUBA' | 'IGBO';
}

interface AuthState {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: null,
  login: (token, user) => {
    localStorage.setItem('agro_token', token);
    localStorage.setItem('agro_user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('agro_token');
    localStorage.removeItem('agro_user');
    set({ token: null, user: null });
  },
  hydrate: () => {
    const token = localStorage.getItem('agro_token');
    const userStr = localStorage.getItem('agro_user');
    if (token && userStr) {
      try { set({ token, user: JSON.parse(userStr) }); } catch { /* ignore */ }
    }
  },
}));
