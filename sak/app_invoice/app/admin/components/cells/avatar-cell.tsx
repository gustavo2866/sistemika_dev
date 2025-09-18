"use client";

import type { RaRecord } from "ra-core";
import { useRecordContext } from "ra-core";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

type KeyOf<T> = Extract<keyof T, string>;

export type AvatarCellProps<T extends Record<string, unknown> = RaRecord> = {
	/** Campo del nombre para fallback (primera letra) */
	nameSource?: KeyOf<T> | string;
	/** Campo con la URL de la imagen */
	urlSource?: KeyOf<T> | string;
	sizeClass?: string;
	fallback?: string;
	altLabel?: string;
};

export function AvatarCell<T extends Record<string, unknown> = RaRecord>({
	nameSource = "nombre" as KeyOf<T>,
	urlSource = "url_foto" as KeyOf<T>,
	sizeClass = "h-9 w-9",
	fallback,
	altLabel = "Avatar",
}: AvatarCellProps<T>) {
	const record = useRecordContext<T>();
	if (!record) return null;

	const rec = record as Record<string, unknown>;
	const nameKey = String(nameSource);
	const urlKey = String(urlSource);

	const nameVal = rec[nameKey];
	const urlVal = rec[urlKey];

	const name = typeof nameVal === "string" ? nameVal : "";
	const url = typeof urlVal === "string" ? urlVal : "";

	const fb = (fallback ?? (name || "U").charAt(0)).toUpperCase();

	return (
		<div className="flex items-center">
			<Avatar className={sizeClass}>
				<AvatarImage src={url} alt={altLabel || name || "Avatar"} />
				<AvatarFallback>{fb}</AvatarFallback>
			</Avatar>
		</div>
	);
}
