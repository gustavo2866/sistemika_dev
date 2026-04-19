import defaultMessages from "ra-language-english";
import polyglotI18nProvider from "ra-i18n-polyglot";
import merge from "lodash/merge";

const spanishOverrides = {
	ra: {
		action: {
			add_filter: "Filtro +",
			cancel: "Cancelar",
			confirm: "Confirmar",
			create: "Crear",
			delete: "Eliminar",
			export: "Exportar",
			save: "Guardar",
		},
		page: {
			list: "Listado",
			create: "Crear",
			edit: "Editar",
			show: "Ver",
		},
		message: {
			delete_title: "Eliminar registro",
			delete_content: "Seguro que deseas eliminar este registro?",
			unsaved_changes:
				"Algunos cambios no fueron guardados. Seguro que deseas descartarlos?",
		},
		notification: {
			updated: "Actualizado correctamente",
			created: "Creado correctamente",
			deleted: "Eliminado correctamente",
		},
		validation: {
			required: "Campo obligatorio",
		},
	},
};

export const i18nProvider = polyglotI18nProvider(
	() => merge({}, defaultMessages, spanishOverrides),
	"en",
	[{ name: "en", value: "English" }],
	{ allowMissing: true }
);
