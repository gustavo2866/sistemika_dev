"use client";

import { CoreAdminContext } from "ra-core";
import { LoginPage } from "@/app/admin/components/auth";
import dataProvider from "@/lib/dataProvider";

// Simple auth provider for login page
const authProvider = {
  login: async ({ username, password }: { username: string; password: string }) => {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    
    if (response.ok) {
      const { access_token } = await response.json();
      localStorage.setItem('auth_token', access_token);
      return Promise.resolve();
    }
    return Promise.reject();
  },
  logout: () => {
    localStorage.removeItem('auth_token');
    return Promise.resolve();
  },
  checkAuth: () => {
    return localStorage.getItem('auth_token') ? Promise.resolve() : Promise.reject();
  },
  checkError: (error: { status?: number }) => {
    const status = error.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem('auth_token');
      return Promise.reject();
    }
    return Promise.resolve();
  },
  getPermissions: () => Promise.resolve(),
};

export default function LoginClient() {
  return (
    <CoreAdminContext dataProvider={dataProvider} authProvider={authProvider}>
      <LoginPage />
    </CoreAdminContext>
  );
}
