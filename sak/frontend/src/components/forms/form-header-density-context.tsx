"use client";

import { createContext, useContext } from "react";

export type FormHeaderDensity = "default" | "compact";

const FormHeaderDensityContext = createContext<FormHeaderDensity>("default");

export const FormHeaderDensityProvider = FormHeaderDensityContext.Provider;

export const useFormHeaderDensity = () => useContext(FormHeaderDensityContext);
