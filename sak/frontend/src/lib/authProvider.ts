import {
  AuthProvider,
  HttpError,
} from "ra-core";

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

const AUTH_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const authProvider: AuthProvider = {
  login: async ({ username, password }: LoginParams) => {
    const response = await fetch(`${AUTH_URL}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new HttpError(payload.detail ?? "Login failed", response.status, payload);
    }

    const { user, token }: LoginResponse = await response.json();
    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_user", JSON.stringify(user));
    return Promise.resolve();
  },
  logout: async () => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      try {
        await fetch(`${AUTH_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.warn("Failed to call logout endpoint", error);
      }
    }
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    return Promise.resolve();
  },
  checkAuth: async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      throw new Error("Not authenticated");
    }
    
    // Verificar expiración del token localmente (JWT tiene formato: header.payload.signature)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = payload.exp && payload.exp * 1000 < Date.now();
      
      if (isExpired) {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        throw new Error("Token expired");
      }
    } catch {
      // Si falla el parseo del token, lo consideramos inválido
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      throw new Error("Invalid token");
    }
    
    return Promise.resolve();
  },
  checkError: async (error) => {
    const status =
      (typeof error === "object" && error && "status" in error && (error as { status?: number }).status) ||
      (typeof error === "object" && error && "response" in error && (error as { response?: { status?: number } }).response?.status);
    if (status === 401 || status === 403) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      throw new Error("Authentication required");
    }
    return Promise.resolve();
  },
  getIdentity: async () => {
    const token = localStorage.getItem("auth_token");
    if (!token) {
      throw new Error("Not authenticated");
    }
    
    // Usar datos almacenados localmente primero (más rápido)
    const stored = localStorage.getItem("auth_user");
    if (stored) {
      try {
        const user = JSON.parse(stored);
        return {
          id: user.id,
          fullName: user.nombre ?? user.email,
          email: user.email,
          avatar: user.url_foto,
        } satisfies UserIdentity;
      } catch (error) {
        console.error("Failed to parse stored user", error);
      }
    }
    
    // Si no hay datos locales, consultar al servidor
    try {
      const response = await fetch(`${AUTH_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const identity = await response.json();
        // Actualizar caché local con los datos del servidor
        localStorage.setItem("auth_user", JSON.stringify({
          id: identity.id,
          nombre: identity.fullName,
          email: identity.email,
          url_foto: identity.avatar,
        }));
        return identity as UserIdentity;
      }
    } catch (error) {
      console.warn("Failed to fetch identity from server", error);
    }
    
    throw new Error("No identity");
  },
  getPermissions: async () => Promise.resolve(["admin"]),
};

