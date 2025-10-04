"use client";

import { useEffect, useState } from "react";
import { CoreAdminContext } from "ra-core";
import { LoginPage } from "@/app/admin/components/auth";
import dataProvider from "@/lib/dataProvider";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "");

const resolveApiUrl = (endpoint: string) => {
  if (!API_BASE) {
    return endpoint;
  }

  const hasApiSegment = /\/api(?:\/|$)/.test(API_BASE);
  const normalizedEndpoint = hasApiSegment
    ? endpoint.replace(/^\/api/, "")
    : endpoint;

  return `${API_BASE}${normalizedEndpoint.startsWith("/") ? normalizedEndpoint : `/${normalizedEndpoint}`}`;
};

// Simple auth provider for login page
const authProvider = {
  login: async ({ username, password }: { username: string; password: string }) => {
    const response = await fetch(resolveApiUrl("/api/auth/login"), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return Promise.reject(errorData.detail || 'No se pudo iniciar sesión');
    }

    const { token, user } = await response.json();
    if (!token) {
      return Promise.reject('Respuesta inválida del servidor');
    }

    localStorage.setItem('auth_token', token);
    if (user) {
      localStorage.setItem('auth_user', JSON.stringify(user));
    }

    return Promise.resolve();
  },
  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    return Promise.resolve();
  },
  checkAuth: () => {
    return localStorage.getItem('auth_token') ? Promise.resolve() : Promise.reject();
  },
  checkError: (error: { status?: number }) => {
    const status = error.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      return Promise.reject();
    }
    return Promise.resolve();
  },
  getPermissions: () => Promise.resolve(),
};

export default function Login() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  }

  return (
    <CoreAdminContext dataProvider={dataProvider} authProvider={authProvider}>
      <LoginPage />
    </CoreAdminContext>
  );
}
