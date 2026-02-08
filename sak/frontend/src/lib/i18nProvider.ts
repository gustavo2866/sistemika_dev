import defaultMessages from "ra-language-english";
import polyglotI18nProvider from "ra-i18n-polyglot";

const spanishOverrides = {
	ra: {
		action: {
			add_filter: "Filtro +",
			cancel: "Cancelar",
			confirm: "Confirmar",
			create: "Crear",
			export: "Exportar",
		},
		page: {
			show: "Ver",
		},
	},
};

export const i18nProvider = polyglotI18nProvider(
	() => ({ ...defaultMessages, ...spanishOverrides }),
	"en",
	[{ name: "en", value: "English" }],
	{ allowMissing: true }
);
