import React, { useState } from 'react';
import { Alert, AlertDescription } from '@workspace/ui/components/alert';
import { Button } from '@workspace/ui/components/button';
import { Card, CardContent, CardHeader, CardTitle } from '@workspace/ui/components/card';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@workspace/ui/components/select';
import { Checkbox } from '@workspace/ui/components/checkbox';
import { Textarea } from '@workspace/ui/components/textarea';

// Sistema de validación inspirado en Zod
class ValidationSchema {
  constructor(public rules: Array<(value: any) => string | null>) {}

  static string() {
    return new ValidationSchema([
      (value) => typeof value !== 'string' ? 'Debe ser una cadena de texto' : null
    ]);
  }

  static email() {
    return new ValidationSchema([
      (value) => typeof value !== 'string' ? 'Debe ser una cadena de texto' : null,
      (value) => {
        const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
        return !emailRegex.test(value) ? 'Email inválido' : null;
      }
    ]);
  }

  static number() {
    return new ValidationSchema([
      (value) => isNaN(Number(value)) ? 'Debe ser un número' : null
    ]);
  }

  static boolean() {
    return new ValidationSchema([
      (value) => typeof value !== 'boolean' ? 'Debe ser verdadero o falso' : null
    ]);
  }

  min(minValue: number, message?: string) {
    this.rules.push((value) => {
      if (typeof value === 'string') {
        return value.length < minValue ? (message || `Mínimo ${minValue} caracteres`) : null;
      }
      if (typeof value === 'number') {
        return value < minValue ? (message || `Mínimo ${minValue}`) : null;
      }
      return null;
    });
    return this;
  }

  max(maxValue: number, message?: string) {
    this.rules.push((value) => {
      if (typeof value === 'string') {
        return value.length > maxValue ? (message || `Máximo ${maxValue} caracteres`) : null;
      }
      if (typeof value === 'number') {
        return value > maxValue ? (message || `Máximo ${maxValue}`) : null;
      }
      return null;
    });
    return this;
  }

  required(message?: string) {
    this.rules.unshift((value) => {
      if (value === null || value === undefined || value === '' || 
          (typeof value === 'boolean' && !value)) {
        return message || 'Este campo es obligatorio';
      }
      return null;
    });
    return this;
  }

  regex(pattern: RegExp, message?: string) {
    this.rules.push((value) => {
      if (typeof value === 'string' && !pattern.test(value)) {
        return message || 'Formato inválido';
      }
      return null;
    });
    return this;
  }

  validate(value: any): string | null {
    for (const rule of this.rules) {
      const error = rule(value);
      if (error) return error;
    }
    return null;
  }
}

// Crear un objeto similar a 'z' de Zod
const z = {
  string: () => ValidationSchema.string(),
  email: () => ValidationSchema.email(),
  number: () => ValidationSchema.number(),
  boolean: () => ValidationSchema.boolean()
};

interface ZodFormExampleProps {
  onClose?: () => void;
}

const ZodFormExample: React.FC<ZodFormExampleProps> = ({ onClose }) => {
  // Configuración de campos con validaciones tipo Zod
  const fields = [
    {
      name: "name",
      label: "Nombre",
      type: "text" as const,
      placeholder: "Ingresa tu nombre",
      schema: z.string().min(2, "Mínimo 2 caracteres").required("El nombre es obligatorio")
    },
    {
      name: "email",
      label: "Email",
      type: "email" as const,
      placeholder: "tu@email.com",
      schema: z.email().required("El email es obligatorio")
    },
    {
      name: "age",
      label: "Edad",
      type: "number" as const,
      placeholder: "18",
      schema: z.number().min(18, "Debes ser mayor de 18 años").max(100, "Edad máxima 100 años").required("La edad es obligatoria")
    },
    {
      name: "username",
      label: "Nombre de usuario",
      type: "text" as const,
      placeholder: "usuario123",
      schema: z.string()
        .min(3, "Mínimo 3 caracteres")
        .max(20, "Máximo 20 caracteres")
        .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y guiones bajos")
        .required("El nombre de usuario es obligatorio")
    },
    {
      name: "role",
      label: "Rol",
      type: "select" as const,
      options: [
        { value: "user", label: "Usuario" },
        { value: "admin", label: "Administrador" },
        { value: "moderator", label: "Moderador" }
      ],
      schema: z.string().required("Selecciona un rol")
    },
    {
      name: "country",
      label: "País",
      type: "select" as const,
      options: [
        { value: "ar", label: "Argentina" },
        { value: "br", label: "Brasil" },
        { value: "uy", label: "Uruguay" },
        { value: "cl", label: "Chile" }
      ],
      schema: z.string() // No requerido
    },
    {
      name: "acceptTerms",
      label: "Acepto los términos y condiciones",
      type: "checkbox" as const,
      schema: z.boolean().required("Debes aceptar los términos y condiciones")
    },
    {
      name: "newsletter",
      label: "Suscribirse al newsletter",
      type: "checkbox" as const,
      schema: z.boolean() // No requerido
    },
    {
      name: "bio",
      label: "Biografía",
      type: "textarea" as const,
      placeholder: "Cuéntanos sobre ti...",
      schema: z.string().max(200, "Máximo 200 caracteres")
    }
  ];

  // Inicializar estado
  const getInitialFormData = () => {
    return fields.reduce((acc, field) => {
      acc[field.name] = field.type === 'checkbox' ? false : 
                       field.type === 'number' ? '' : '';
      return acc;
    }, {} as Record<string, any>);
  };

  const [formData, setFormData] = useState(getInitialFormData());
  const [errors, setErrors] = useState({} as Record<string, string>);
  const [touched, setTouched] = useState({} as Record<string, boolean>);

  // Validar campo individual usando el schema
  const validateField = (fieldConfig: any, value: any) => {
    // Convertir valor para validación
    let validationValue = value;
    if (fieldConfig.type === 'number' && value !== '') {
      validationValue = Number(value);
    }

    return fieldConfig.schema.validate(validationValue);
  };

  // Validar todo el formulario
  const validateAllFields = () => {
    const newErrors: Record<string, string> = {};
    
    fields.forEach(field => {
      const error = validateField(field, formData[field.name]);
      if (error) {
        newErrors[field.name] = error;
      }
    });
    
    return newErrors;
  };

  // Manejar cambios
  const handleFieldChange = (fieldName: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldName]: value
    }));

    if (touched[fieldName]) {
      const fieldConfig = fields.find(f => f.name === fieldName);
      if (fieldConfig) {
        const error = validateField(fieldConfig, value);
        setErrors(prev => ({
          ...prev,
          [fieldName]: error || ''
        }));
      }
    }
  };

  const handleFieldBlur = (fieldName: string) => {
    setTouched(prev => ({
      ...prev,
      [fieldName]: true
    }));

    const fieldConfig = fields.find(f => f.name === fieldName);
    if (fieldConfig) {
      const error = validateField(fieldConfig, formData[fieldName]);
      setErrors(prev => ({
        ...prev,
        [fieldName]: error || ''
      }));
    }
  };

  const handleSubmit = () => {
    const newErrors = validateAllFields();
    setErrors(newErrors);
    setTouched(fields.reduce((acc, field) => ({...acc, [field.name]: true}), {}));

    const hasErrors = Object.values(newErrors).some(error => error);
    
    if (!hasErrors) {
      // Transformar datos para envío
      const transformedData = { ...formData };
      if (transformedData.age) {
        transformedData.age = Number(transformedData.age);
      }
      
      console.log('Datos validados:', transformedData);
      console.log('Schema de validación aplicado correctamente');
      alert('¡Formulario validado con Zod-like schema! Revisa la consola.');
      handleReset();
    }
  };

  const handleReset = () => {
    setFormData(getInitialFormData());
    setErrors({});
    setTouched({});
  };

  // Renderizar campos
  const renderField = (field: any) => {
    const hasError = errors[field.name];
    const isRequired = field.schema.rules.some((rule: any) => 
      rule.toString().includes('obligatorio') || rule.toString().includes('requerido')
    );

    switch (field.type) {
      case 'text':
      case 'email':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label} {isRequired &&                 <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={field.name}
              type={field.type}
              placeholder={field.placeholder}
              value={formData[field.name]}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              onBlur={() => handleFieldBlur(field.name)}
              className={hasError ? 'border-destructive' : ''}
            />
            {hasError && (
              <p className="text-sm text-destructive">{hasError}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={field.name}
              type="number"
              placeholder={field.placeholder}
              value={formData[field.name]}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              onBlur={() => handleFieldBlur(field.name)}
              className={hasError ? 'border-destructive' : ''}
            />
            {hasError && (
              <p className="text-sm text-destructive">{hasError}</p>
            )}
          </div>
        );

      case 'select':
        return (
          <div key={field.name} className="space-y-2">
            <Label>
              {field.label} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            <Select 
              value={formData[field.name]} 
              onValueChange={(value) => handleFieldChange(field.name, value)}
              onOpenChange={() => handleFieldBlur(field.name)}
            >
              <SelectTrigger className={hasError ? 'border-destructive' : ''}>
                <SelectValue placeholder={`Selecciona ${field.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option: any) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasError && (
              <p className="text-sm text-destructive">{hasError}</p>
            )}
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.name} className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id={field.name}
                checked={formData[field.name]}
                onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
                onBlur={() => handleFieldBlur(field.name)}
              />
              <Label htmlFor={field.name} className="text-sm">
                {field.label} {isRequired && <span className="text-red-500">*</span>}
              </Label>
            </div>
            {hasError && (
              <p className="text-sm text-destructive">{hasError}</p>
            )}
          </div>
        );

      case 'textarea':
        const maxLength = field.schema.rules.find((rule: any) => 
          rule.toString().includes('Máximo')
        );
        const maxLengthValue = maxLength ? 200 : null;

        return (
          <div key={field.name} className="space-y-2">
            <Label htmlFor={field.name}>
              {field.label} {isRequired && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id={field.name}
              placeholder={field.placeholder}
              value={formData[field.name]}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              onBlur={() => handleFieldBlur(field.name)}
              className={hasError ? 'border-destructive' : ''}
              rows={3}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {formData[field.name]?.length || 0} / {maxLengthValue || '∞'} caracteres
              </span>
            </div>
            {hasError && (
              <p className="text-sm text-destructive">{hasError}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const hasErrors = Object.values(errors).some(error => error);
  const validFieldsCount = Object.keys(formData).filter(key => {
    const value = formData[key];
    return value !== '' && value !== false && value !== null && value !== undefined;
  }).length;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Formulario con Validación Zod-like</CardTitle>
          <p className="text-muted-foreground">
            Sistema de validación inspirado en Zod con schemas declarativos
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Renderizar campos */}
          {fields.map(field => renderField(field))}

          {/* Estado del formulario */}
          <Card className={`${hasErrors ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}`}>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className={`text-sm font-medium ${hasErrors ? 'text-red-800' : 'text-blue-800'}`}>
                    Estado de validación
                  </h3>
                  <p className={`text-xs ${hasErrors ? 'text-red-600' : 'text-blue-600'}`}>
                    {hasErrors ? 'Hay errores en el formulario' : 'Formulario válido'}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${hasErrors ? 'text-red-600' : 'text-blue-600'}`}>
                    {validFieldsCount}/{fields.length}
                  </div>
                  <div className={`text-xs ${hasErrors ? 'text-red-500' : 'text-blue-500'}`}>
                    campos completados
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Botones */}
          <div className="flex gap-4 pt-4">
            <Button
              onClick={handleSubmit}
              className="flex-1"
              size="lg"
              disabled={hasErrors}
            >
              Validar y Enviar
            </Button>
            
            <Button
              variant="outline"
              onClick={handleReset}
              size="lg"
            >
              Limpiar
            </Button>
          </div>

          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">
              Los campos marcados con <span className="text-red-500">*</span> son obligatorios
            </p>
            <p className="text-xs text-muted-foreground">
              Validación con schemas declarativos tipo Zod
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ZodFormExample;
// Export default ZodFormExample