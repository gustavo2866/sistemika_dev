// Tipos de autenticación para TypeScript
export interface LoginParams {
  username: string;
  password: string;
}

export interface UserIdentity {
  id: number;
  fullName: string;
  email: string;
  avatar?: string;
}

export interface LoginResponse {
  user: {
    id: number;
    nombre: string;
    email: string;
    telefono?: string;
    url_foto?: string;
    pais_id?: number;
  };
  token: string;
}

export interface AuthUser {
  id: number;
  nombre: string;
  email: string;
  telefono?: string;
  url_foto?: string;
  pais_id?: number;
}

// Re-export del authProvider para facilitar imports
export { authProvider, addAuthToDataProvider, getAuthToken, isAuthenticated } from './authProvider';
