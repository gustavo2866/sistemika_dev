"use client";

import { TextInput } from "@/components/text-input";
import { NumberInput } from "@/components/number-input";
import { ImageUploadInput } from "@/app/admin/components/inputs/image-upload";
import { ReferenceInput } from "@/components/reference-input";
import { AutocompleteInput } from "@/components/autocomplete-input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { uploadUserPhoto } from "@/lib/upload";
import React from "react";

export interface FieldConfig {
	source: string;
	label?: string;
	placeholder?: string;
	helperText?: string;
	type: 'text' | 'email' | 'tel' | 'number' | 'image' | 'reference';
	required?: boolean;
	reference?: string; // Para ReferenceInput
	optionText?: string; // Campo a mostrar en ReferenceInput
	uploadFn?: (file: File) => Promise<string>;
	gridCols?: 1 | 2; // Para grid responsive
	min?: number; // Para number input
	step?: number; // Para number input
}

export interface SectionConfig {
	title: string;
	icon?: React.ReactNode;
	fields: FieldConfig[];
	columns?: 1 | 2; // Columnas del grid de la sección
}

export interface ResourceFormConfig {
	sections: SectionConfig[];
	maxWidth?: string;
}

const renderField = (config: FieldConfig) => {
	const baseProps = {
		source: config.source,
		label: config.label,
		placeholder: config.placeholder,
		helperText: config.helperText,
		required: config.required,
	};

	const gridClass = config.gridCols === 2 ? "md:col-span-2" : "";

	switch (config.type) {
		case 'email':
			return (
				<div key={config.source} className={gridClass}>
					<TextInput {...baseProps} type="email" />
				</div>
			);
    
		case 'tel':
			return (
				<div key={config.source} className={gridClass}>
					<TextInput {...baseProps} type="tel" />
				</div>
			);

		case 'number':
			return (
				<div key={config.source} className={gridClass}>
					<NumberInput {...baseProps} min={config.min} step={config.step} />
				</div>
			);
    
		case 'image':
			return (
				<div key={config.source} className={gridClass}>
					<ImageUploadInput 
						{...baseProps} 
						uploadFn={config.uploadFn || uploadUserPhoto}
					/>
				</div>
			);
    
		case 'reference':
			return (
				<div key={config.source} className={gridClass}>
					<ReferenceInput {...baseProps} reference={config.reference!}>
						<AutocompleteInput optionText={config.optionText} />
					</ReferenceInput>
				</div>
			);
    
		default:
			return (
				<div key={config.source} className={gridClass}>
					<TextInput {...baseProps} />
				</div>
			);
	}
};

const renderSection = (section: SectionConfig, index: number) => {
	const gridCols = section.columns === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2";
  
	return (
		<Card key={index}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					{section.icon}
					{section.title}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className={`grid ${gridCols} gap-4`}>
					{section.fields.map(renderField)}
				</div>
			</CardContent>
		</Card>
	);
};

export const ResourceFormWrapper = ({ config }: { config: ResourceFormConfig }) => {
	return (
		<div className="space-y-6">
			{config.sections.map(renderSection)}
		</div>
	);
};
