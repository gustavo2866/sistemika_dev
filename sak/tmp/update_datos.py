from pathlib import Path
path = Path('frontend/src/app/resources/crm-oportunidades/form.tsx')
text = path.read_text()
old = """const DatosGeneralesSection = () => (
  <FormSimpleSection className=\"space-y-5\">
    <div className=\"grid grid-cols-1 gap-5\">
      <ReferenceInput source=\"contacto_id\" reference=\"crm/contactos\" label=\"Contacto\">
        <SelectInput optionText=\"nombre_completo\" className=\"w-full\" validate={required()} />
      </ReferenceInput>
      <ReferenceInput source=\"responsable_id\" reference=\"users\" label=\"Responsable\">
        <SelectInput optionText=\"nombre\" className=\"w-full\" validate={required()} />
      </ReferenceInput>
                <ReferenceInput
                  source=\"tipo_operacion_id\"
                  reference=\"tipos-operacion\"
                  label=\"Tipo de operacion\"
                >
                  <SelectInput
                    optionText={(record) =>
                      record?.id ? f\"{record.id} - {record.descripcion or record.codigo or ''}\" : ''
                    }
                    className=\"w-full\"
                    validate={required()}
                  />
                </ReferenceInput>
      <TextInput source=\"descripcion_estado\" label=\"Descripci?n\" multiline className=\"w-full\" />
    </div>
  </FormSimpleSection>
);
"""
new = '''const DatosGeneralesSection = ({ contactoName, responsableName }: DatosGeneralesSectionProps) => (
  <FormSimpleSection className="space-y-6">
    <div className="rounded-2xl border border-border/60 bg-muted/50 p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Resumen</p>
      <div className="mt-2 flex flex-wrap gap-3">
        <Badge className="px-3 py-1 text-sm uppercase tracking-wide">{contactoName}</Badge>
        <Badge className="px-3 py-1 text-sm uppercase tracking-wide">{responsableName}</Badge>
      </div>
    </div>
    <div className="grid grid-cols-1 gap-5">
      <ReferenceInput source="contacto_id" reference="crm/contactos" label="Contacto">
        <SelectInput optionText="nombre_completo" className="w-full" validate={required()} />
      </ReferenceInput>
      <ReferenceInput source="responsable_id" reference="users" label="Responsable">
        <SelectInput optionText="nombre" className="w-full" validate={required()} />
      </ReferenceInput>
      <ReferenceInput source="tipo_operacion_id" reference="tipos-operacion" label="Tipo de operación">
        <SelectInput
          optionText={(record) =>
            record?.id ? f"{record.id} - {record.descripcion or record.codigo or ''}" : ''
          }
          className="w-full"
          validate={required()}
        />
      </ReferenceInput>
      <TextInput source="descripcion_estado" label="Descripción" multiline className="w-full" />
    </div>
  </FormSimpleSection>
);
'''
if old not in text:
    raise SystemExit('old datos section not found')
text = text.replace(old, new, 1)
path.write_text(text)
