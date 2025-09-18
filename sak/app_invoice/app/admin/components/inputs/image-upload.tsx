"use client";

import { useController, useFormContext } from "react-hook-form";
import { useState, useRef, useCallback } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { 
	Dialog, 
	DialogContent, 
	DialogHeader, 
	DialogTitle, 
	DialogDescription 
} from "@/components/ui/dialog";
import { 
	Card, 
	CardContent 
} from "@/components/ui/card";
import { 
	Upload, 
	ImageIcon, 
	X, 
	Camera, 
	Loader2 
} from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
	source: string;                    // p.ej. "url_foto"
	label?: string;
	uploadFn: (file: File) => Promise<string>;
	accept?: string;
	maxSize?: number; // En MB
	className?: string;
};

export function ImageUploadInput({
	source,
	label = "Imagen",
	uploadFn,
	accept = "image/*",
	maxSize = 5, // 5MB por defecto
	className,
}: Props) {
	const { control, setValue, watch } = useFormContext();
	const { fieldState } = useController({ name: source, control });
	const currentUrl = watch(source) as string | undefined;
	const [isUploading, setUploading] = useState(false);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [isDragOver, setIsDragOver] = useState(false);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const validateFile = useCallback((file: File): string | null => {
		if (file.size > maxSize * 1024 * 1024) {
			return `El archivo es muy grande. Máximo ${maxSize}MB permitido.`;
		}
		if (!file.type.startsWith('image/')) {
			return 'Solo se permiten archivos de imagen.';
		}
		return null;
	}, [maxSize]);

	const handleFileSelect = useCallback(async (file: File) => {
		const error = validateFile(file);
		if (error) {
			alert(error);
			return;
		}

		// Crear preview
		const reader = new FileReader();
		reader.onload = (e) => {
			setPreviewUrl(e.target?.result as string);
		};
		reader.readAsDataURL(file);

		setUploading(true);
		try {
			const url = await uploadFn(file);
			setValue(source, url, { shouldDirty: true, shouldValidate: true });
			setIsDialogOpen(false);
			setPreviewUrl(null);
		} catch (error) {
			console.error('Error uploading file:', error);
			alert('Error al subir la imagen. Inténtalo de nuevo.');
		} finally {
			setUploading(false);
		}
	}, [uploadFn, setValue, source, validateFile]);

	const onFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		await handleFileSelect(file);
		// Limpiar el input para permitir seleccionar el mismo archivo de nuevo
		if (fileInputRef.current) {
			fileInputRef.current.value = '';
		}
	};

	const onDrop = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
		const file = e.dataTransfer.files[0];
		if (file) {
			handleFileSelect(file);
		}
	}, [handleFileSelect]);

	const onDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(true);
	}, []);

	const onDragLeave = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		setIsDragOver(false);
	}, []);

	const removeImage = () => {
		setValue(source, "", { shouldDirty: true, shouldValidate: true });
		setPreviewUrl(null);
	};

	const openFileDialog = () => {
		fileInputRef.current?.click();
	};

	return (
		<div className={cn("space-y-2", className)}>
			{label && (
				<label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
					{label}
				</label>
			)}
      
			{/* Vista principal de la imagen */}
			<div className="flex items-center gap-4">
				<div className="relative group">
					<Avatar 
						className="h-20 w-20 cursor-pointer transition-opacity group-hover:opacity-80"
						onClick={() => setIsDialogOpen(true)}
					>
						{currentUrl ? (
							<AvatarImage src={currentUrl} alt={label} />
						) : (
							<AvatarFallback className="bg-muted">
								<Camera className="h-8 w-8 text-muted-foreground" />
							</AvatarFallback>
						)}
					</Avatar>
          
					{/* Overlay de hover */}
					<div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-full flex items-center justify-center cursor-pointer"
							 onClick={() => setIsDialogOpen(true)}>
						<Camera className="h-6 w-6 text-white" />
					</div>
          
					{/* Botón de eliminar */}
					{currentUrl && (
						<Button
							type="button"
							variant="destructive"
							size="icon"
							className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
							onClick={(e) => {
								e.stopPropagation();
								removeImage();
							}}
						>
							<X className="h-3 w-3" />
						</Button>
					)}
				</div>
        
				<div className="flex flex-col gap-2">
					<Button 
						type="button" 
						variant="outline" 
						onClick={() => setIsDialogOpen(true)}
						disabled={isUploading}
					>
						{isUploading ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Subiendo...
							</>
						) : (
							<>
								<Upload className="h-4 w-4 mr-2" />
								{currentUrl ? 'Cambiar imagen' : 'Subir imagen'}
							</>
						)}
					</Button>
          
					{currentUrl && (
						<Button 
							type="button" 
							variant="ghost" 
							size="sm"
							onClick={removeImage}
							className="text-destructive hover:text-destructive"
						>
							<X className="h-3 w-3 mr-1" />
							Eliminar
						</Button>
					)}
				</div>
			</div>

			{/* Error de validación */}
			{fieldState.error && (
				<p className="text-sm text-destructive">{fieldState.error.message}</p>
			)}

			{/* Input oculto */}
			<input
				ref={fileInputRef}
				type="file"
				accept={accept}
				onChange={onFileSelect}
				className="hidden"
			/>

			{/* Dialog de selección */}
			<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Seleccionar imagen</DialogTitle>
						<DialogDescription>
							Arrastra una imagen aquí o haz clic para seleccionar un archivo.
							Máximo {maxSize}MB.
						</DialogDescription>
					</DialogHeader>
          
					{/* Zona de drag & drop */}
					<Card 
						className={cn(
							"border-2 border-dashed transition-colors cursor-pointer",
							isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25",
							isUploading && "pointer-events-none opacity-50"
						)}
						onDrop={onDrop}
						onDragOver={onDragOver}
						onDragLeave={onDragLeave}
						onClick={openFileDialog}
					>
						<CardContent className="flex flex-col items-center justify-center p-8 text-center">
							{previewUrl ? (
								<div className="space-y-4">
									{/* eslint-disable-next-line @next/next/no-img-element */}
									<img 
										src={previewUrl} 
										alt="Preview" 
										className="max-h-32 max-w-full object-contain rounded-md"
									/>
									<p className="text-sm text-muted-foreground">
										Click para cambiar o arrastra una nueva imagen
									</p>
								</div>
							) : (
								<div className="space-y-4">
									<div className="mx-auto bg-muted rounded-full p-3">
										<ImageIcon className="h-8 w-8 text-muted-foreground" />
									</div>
									<div className="space-y-2">
										<p className="text-sm font-medium">
											{isDragOver ? 'Suelta la imagen aquí' : 'Selecciona una imagen'}
										</p>
										<p className="text-xs text-muted-foreground">
											Arrastra y suelta o haz clic para examinar
										</p>
										<p className="text-xs text-muted-foreground">
											Formatos: JPG, PNG, GIF - Máximo {maxSize}MB
										</p>
									</div>
								</div>
							)}
              
							{isUploading && (
								<div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-md">
									<div className="flex items-center gap-2">
										<Loader2 className="h-4 w-4 animate-spin" />
										<span className="text-sm">Subiendo...</span>
									</div>
								</div>
							)}
						</CardContent>
					</Card>
				</DialogContent>
			</Dialog>
		</div>
	);
}
