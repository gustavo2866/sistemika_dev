import defaultMessages from "ra-language-english";
import polyglotI18nProvider from "ra-i18n-polyglot";

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
		},
		notification: {
			updated: "Actualizado correctamente",
			created: "Creado correctamente",
			deleted: "Eliminado correctamente",
		},
	},
};

export const i18nProvider = polyglotI18nProvider(
	() => ({ ...defaultMessages, ...spanishOverrides }),
	"en",
	[{ name: "en", value: "English" }],
	{ allowMissing: true }
);
