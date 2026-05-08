export type UserRole = 'FARMER' | 'AGGREGATOR' | 'ADMIN';
export type UserLanguage = 'EN' | 'PIDGIN' | 'HAUSA' | 'YORUBA' | 'IGBO';

export interface AuthUser {
  id: string;
  phone: string;
  role: UserRole;
  language: UserLanguage;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface SignupRequest {
  phone: string;
  pin: string;
  role: UserRole;
  language: UserLanguage;
}

export interface LoginRequest {
  phone: string;
  pin: string;
}
