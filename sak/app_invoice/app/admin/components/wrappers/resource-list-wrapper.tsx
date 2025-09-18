"use client";

import { List } from "@/components/list";
import { DataTable } from "@/components/data-table"; // Using shadcn-admin-kit DataTable
import { TextField } from "@/components/text-field"; // Using shadcn-admin-kit TextField
import { ReferenceField } from "@/components/reference-field"; // Using shadcn-admin-kit ReferenceField
import { EditButton } from "@/components/edit-button";
import { AvatarCell } from "@/app/admin/components/cells/avatar-cell";
import { TextInput } from "@/components/text-input";
import { FilterButton } from "@/components/filter-form";
import { CreateButton } from "@/components/create-button";
import { ExportButton } from "@/components/export-button";
import { ReferenceInput } from "@/components/reference-input";
import { AutocompleteInput } from "@/components/autocomplete-input";
import { BulkActionsToolbar } from "@/components/bulk-actions-toolbar";
import React from "react";
import type { FilterElementProps } from "@/hooks/filter-context";

export interface FilterConfig {
	source: string;
	label?: string | false;
	placeholder?: string;
	alwaysOn?: boolean;
	type?: 'text' | 'reference';
	reference?: string;
}

export interface ColumnConfig {
	source?: string;
	label?: string;
	type: 'text' | 'avatar' | 'reference' | 'actions' | 'id';
	nameSource?: string; // Para avatar
	urlSource?: string;  // Para avatar
	reference?: string;  // Para reference field
	referenceSource?: string; // Campo a mostrar de la referencia
}

export interface ResourceListConfig {
	filters: FilterConfig[];
	columns: ColumnConfig[];
	perPage?: number;
	debounce?: number;
	rowClick?: string;
	bulkActions?: React.ReactNode; // Acciones bulk personalizadas
	prefetch?: string[]; // Referencias a precargar automáticamente
}

const renderFilter = (config: FilterConfig): React.ReactElement<FilterElementProps> => {
	const baseProps = {
		source: config.source,
		label: config.label,
		placeholder: config.placeholder,
		alwaysOn: config.alwaysOn,
	};

	switch (config.type) {
		case 'reference':
			return (
				<ReferenceInput {...baseProps} reference={config.reference!}>
					<AutocompleteInput optionText="nombre" />
				</ReferenceInput>
			);
		default:
			return <TextInput {...baseProps} />;
	}
};

const renderColumn = (config: ColumnConfig) => {
	switch (config.type) {
		case 'id':
			return (
				<DataTable.Col key={config.source} label={config.label || 'ID'}>
					<TextField source={config.source!} />
				</DataTable.Col>
			);
    
		case 'text':
			return (
				<DataTable.Col key={config.source} label={config.label}>
					<TextField source={config.source!} />
				</DataTable.Col>
			);
    
		case 'avatar':
			return (
				<DataTable.Col key="avatar" label={config.label || 'Avatar'}>
					<AvatarCell 
						nameSource={config.nameSource!} 
						urlSource={config.urlSource!} 
					/>
				</DataTable.Col>
			);
    
		case 'reference':
			return (
				<DataTable.Col key={config.source} label={config.label}>
					<ReferenceField source={config.source!} reference={config.reference!} />
				</DataTable.Col>
			);
    
		case 'actions':
			return (
				<DataTable.Col key="actions" label="">
					<EditButton />
				</DataTable.Col>
			);
    
		default:
			return null;
	}
};

const ListActions = ({ filters }: { filters: React.ReactElement<FilterElementProps>[] }) => (
	<div className="flex items-center gap-2">
		<FilterButton filters={filters} />
		<CreateButton />
		<ExportButton />
	</div>
);

export const ResourceListWrapper = ({ config }: { config: ResourceListConfig }) => {
	const filterElements = config.filters.map((filter) => renderFilter(filter));
  
	// Auto-detectar referencias para prefetch si no se especifica
	const prefetchRefs = config.prefetch || config.columns
		.filter(col => col.type === 'reference' && col.reference)
		.map(col => col.reference!);
  
	// Preparar queryOptions con prefetch si hay referencias
	const queryOptions = prefetchRefs.length > 0 
		? { meta: { prefetch: prefetchRefs } }
		: undefined;
  
	return (
		<List 
			filters={filterElements} 
			debounce={config.debounce || 300} 
			perPage={config.perPage || 25} 
			actions={<ListActions filters={filterElements} />}
			queryOptions={queryOptions}
		>
			<DataTable rowClick={config.rowClick || "edit"}>
				{config.columns.map(renderColumn)}
			</DataTable>
			{config.bulkActions && (
				<BulkActionsToolbar>
					{config.bulkActions}
				</BulkActionsToolbar>
			)}
		</List>
	);
};
