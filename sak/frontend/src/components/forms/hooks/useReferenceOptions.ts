import { useState, useEffect } from "react";
import { useDataProvider } from "ra-core";

interface ReferenceOption {
  id: number;
  nombre: string;
}

export const useReferenceOptions = (
  resource: string,
  optionTextField: string = "nombre",
  perPage: number = 100,
  sortField?: string,
  sortOrder: "ASC" | "DESC" = "ASC"
) => {
  const dataProvider = useDataProvider();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<ReferenceOption[]>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    
    dataProvider
      .getList(resource, {
        pagination: { page: 1, perPage },
        sort: { field: sortField || optionTextField, order: sortOrder },
        filter: {},
      })
      .then(({ data }: { data: any[] }) => {
        if (!mounted) return;
        setOptions(
          data.map((item: any) => ({
            id: item.id,
            nombre: item[optionTextField] || item.nombre || "",
          }))
        );
      })
      .catch((error) => {
        console.error(`Error loading ${resource}:`, error);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [dataProvider, resource, optionTextField, perPage, sortField, sortOrder]);

  return { options, loading };
};
