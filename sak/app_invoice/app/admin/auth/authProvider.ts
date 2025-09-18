import { 
  AuthProvider, 
  HttpError,
  DataProvider,
  GetListParams,
  GetOneParams,
  GetManyParams,
  GetManyReferenceParams,
  CreateParams,
  UpdateParams,
  UpdateManyParams,
  DeleteParams,
  DeleteManyParams
} from "ra-core";

// Tipos para el auth
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

/**
 * AuthProvider que combina:
 * - Endpoints auth específicos (/api/auth/*)
 * - CRUD genérico existente para gestión de usuarios (/users)
 * 
 * Adaptado para usar estructura de usuarios existente en tu app
 */
export const authProvider: AuthProvider = {
  /**
   * LOGIN - Usar endpoint auth específico
   */
  login: async ({ username, password }: LoginParams) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new HttpError(
        errorData.detail || 'Login failed', 
        response.status,
        errorData
      );
    }

    const { user, token }: LoginResponse = await response.json();
    
    // Guardar token y datos del usuario
    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));
    
    return Promise.resolve();
  },

  /**
   * LOGOUT - Usar endpoint auth específico
   */
  logout: async () => {
    const token = localStorage.getItem('auth_token');
    
    // Llamar al endpoint de logout
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        });
      } catch (error) {
        // No fallar si el logout del servidor falla
        console.warn('Server logout failed:', error);
      }
    }
    
    // Limpiar storage local
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    
    return Promise.resolve();
  },

  /**
   * CHECK AUTH - Verificar token válido
   */
  checkAuth: async () => {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      throw new Error('No token found');
    }

    // Verificar token con el servidor
    try {
      const response = await fetch('/api/auth/check', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (!response.ok) {
        // Token inválido o expirado
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        throw new Error('Token invalid or expired');
      }

      return Promise.resolve();
    } catch (error) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      throw error;
    }
  },

  /**
   * CHECK ERROR - Manejar errores 401/403
   */
  checkError: async (error: Error | { status?: number; response?: { status?: number } }) => {
    const status = error && typeof error === 'object' && 'status' in error 
      ? error.status 
      : error && typeof error === 'object' && 'response' in error && error.response
      ? error.response.status
      : undefined;
    
    if (status === 401 || status === 403) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      throw new Error('Authentication required');
    }
    
    return Promise.resolve();
  },

  /**
   * GET IDENTITY - Obtener usuario actual
   * Usar endpoint auth específico para datos actualizados
   */
  getIdentity: async (): Promise<UserIdentity> => {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      throw new Error('No authentication token');
    }

    try {
      // Intentar obtener desde endpoint /me (datos actualizados)
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      });

      if (response.ok) {
        const identity: UserIdentity = await response.json();
        return identity;
      }
    } catch (error) {
      console.warn('Failed to fetch from /me endpoint:', error);
    }

    // Fallback: usar datos del localStorage
    const storedUser = localStorage.getItem('auth_user');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        return {
          id: user.id,
          fullName: user.nombre || user.email,
          email: user.email,
          avatar: user.url_foto
        };
      } catch (error) {
        console.error('Failed to parse stored user:', error);
      }
    }

    throw new Error('No user identity available');
  },

  /**
   * GET PERMISSIONS - Obtener permisos del usuario
   * Por ahora retorna permisos básicos, se puede expandir
   */
  getPermissions: async () => {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      return Promise.resolve([]);
    }

    // Por ahora, todos los usuarios autenticados tienen permisos de admin
    // En el futuro se puede expandir con roles/permisos específicos
    return Promise.resolve(['admin']);
  }
};

/**
 * Función helper para agregar token a requests del dataProvider
 * Se puede usar para interceptar requests y agregar Authorization header
 */
export const addAuthToDataProvider = (dataProvider: DataProvider) => {
  return {
    ...dataProvider,
    // Intercept all methods to add auth header
    getList: (resource: string, params: GetListParams) => {
      return dataProvider.getList(resource, params);
    },
    getOne: (resource: string, params: GetOneParams) => {
      return dataProvider.getOne(resource, params);
    },
    getMany: (resource: string, params: GetManyParams) => {
      return dataProvider.getMany(resource, params);
    },
    getManyReference: (resource: string, params: GetManyReferenceParams) => {
      return dataProvider.getManyReference(resource, params);
    },
    create: (resource: string, params: CreateParams) => {
      return dataProvider.create(resource, params);
    },
    update: (resource: string, params: UpdateParams) => {
      return dataProvider.update(resource, params);
    },
    updateMany: (resource: string, params: UpdateManyParams) => {
      return dataProvider.updateMany(resource, params);
    },
    delete: (resource: string, params: DeleteParams) => {
      return dataProvider.delete(resource, params);
    },
    deleteMany: (resource: string, params: DeleteManyParams) => {
      return dataProvider.deleteMany(resource, params);
    }
  };
};

// Helper para obtener el token actual
export const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

// Helper para verificar si el usuario está loggeado
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('auth_token');
};
