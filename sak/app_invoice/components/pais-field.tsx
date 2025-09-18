"use client";

import React from "react";

type PaisFieldProps = {
	value?: React.ReactNode;
};

export const PaisField: React.FC<PaisFieldProps> = ({ value }) => {
	return <span>{value ?? ""}</span>;
};

export default PaisField;
