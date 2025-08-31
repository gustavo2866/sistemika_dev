// DataProvider estándar siguiendo EXACTAMENTE el tutorial oficial
import { fetchUtils, DataProvider } from 'react-admin';
import jsonServerProvider from 'ra-data-json-server';

const httpClient = fetchUtils.fetchJson;

// Crear el dataProvider base estándar
const baseDataProvider = jsonServerProvider(
  process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000',
  httpClient
);

// Extender siguiendo EXACTAMENTE el patrón del tutorial oficial
export const dataProvider: DataProvider = {
  ...baseDataProvider,
  
  // deleteMany siguiendo EXACTAMENTE el tutorial oficial
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
      
      // CRÍTICO: React-admin espera los IDs eliminados, NO los objetos
      return { 
        data: params.ids  // Devolver SIEMPRE los IDs que se enviaron
      };
    });
  },
};

export default dataProvider;
