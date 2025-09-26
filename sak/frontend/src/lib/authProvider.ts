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
    try {
      const response = await fetch(`${AUTH_URL}/api/auth/check`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error("Invalid token");
      }
    } catch (error) {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_user");
      throw error;
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
    try {
      const response = await fetch(`${AUTH_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        return response.json() as Promise<UserIdentity>;
      }
    } catch (error) {
      console.warn("Failed to fetch identity", error);
    }
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
    throw new Error("No identity");
  },
  getPermissions: async () => Promise.resolve(["admin"]),
};

