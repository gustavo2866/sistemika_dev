// Traditional configuration for Tareas resource
export const tareaConfig = {
  name: 'tareas',
  displayName: 'Tareas',
  recordRepresentation: 'titulo',
  
  // Field definitions for reference
  fields: {
    titulo: 'Título',
    descripcion: 'Descripción', 
    estado: 'Estado',
    prioridad: 'Prioridad',
    fecha_vencimiento: 'Fecha de Vencimiento',
    user_id: 'Usuario Asignado'
  },
  
  // Estado options
  estadoOptions: [
    { id: 'pendiente', name: 'Pendiente' },
    { id: 'en_proceso', name: 'En Proceso' },
    { id: 'completada', name: 'Completada' },
    { id: 'cancelada', name: 'Cancelada' }
  ],
  
  // Prioridad options
  prioridadOptions: [
    { id: 'baja', name: 'Baja' },
    { id: 'media', name: 'Media' },
    { id: 'alta', name: 'Alta' },
    { id: 'urgente', name: 'Urgente' }
  ]
};
