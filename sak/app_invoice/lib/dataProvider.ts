// DataProvider para API REST estándar (FastAPI)
import { fetchUtils, DataProvider } from 'ra-core';
import simpleRestProvider from 'ra-data-simple-rest';

const httpClient = fetchUtils.fetchJson;

// Crear el dataProvider base para REST estándar
const baseDataProvider = simpleRestProvider(
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000',
  httpClient
);

// Extender para operaciones específicas solamente
export const dataProvider: DataProvider = {
  ...baseDataProvider,
  
  // deleteMany siguiendo el patrón estándar
  deleteMany: (resource, params) => {
    const query = {
      filter: JSON.stringify({ id: params.ids }),
    };
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const queryString = `filter=${encodeURIComponent(query.filter)}`;
    
    console.log('🔥 BULK DELETE Frontend - IDs a eliminar:', params.ids);
    console.log('🌐 DELETE URL:', `${apiUrl}/${resource}?${queryString}`);
    
    return httpClient(`${apiUrl}/${resource}?${queryString}`, {
      method: 'DELETE',
    }).then(({ json }) => {
      console.log('✅ DELETE Response del backend:', json);
      
      return { 
        data: params.ids  // Devolver SIEMPRE los IDs que se enviaron
      };
    });
  },
};

export default dataProvider;
