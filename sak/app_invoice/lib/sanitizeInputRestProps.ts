/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Función que remueve props específicos de React Admin para evitar que lleguen al DOM.
 * Los props extraídos son internos de React Admin y no deben pasarse a elementos HTML nativos.
 */
export const sanitizeInputRestProps = ({
  afterSubmit,
  allowNull,
  alwaysOn,
  beforeSubmit,
  component,
  data,
  defaultValue,
  error,
  format,
  formatOnBlur,
  helperText,
  initializeForm,
  input,
  isEqual,
  isRequired,
  label,
  limitChoicesToValue,
  locale,
  meta,
  multiple,
  name,
  options,
  optionText,
  optionValue,
  parse,
  record,
  ref,
  refetch,
  render,
  resource,
  setFilter,
  setPagination,
  setSort,
  shouldUnregister,
  source,
  submitError,
  subscription,
  textAlign,
  translate,
  translateChoice,
  validate,
  validateFields,
  ...rest
}: any) => rest;
