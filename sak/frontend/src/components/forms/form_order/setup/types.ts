import type { ComponentType } from "react";

export type SetupView = "list" | "create" | "edit";

export type SetupListComponentProps = {
  embedded?: boolean;
  rowClick?: any;
  perPage?: number;
};

export type SetupCreateComponentProps = {
  embedded?: boolean;
  redirect?: string | false;
};

export type SetupEditComponentProps = {
  embedded?: boolean;
  id?: string | number;
  redirect?: string | false;
};

export type SetupCustomComponentProps = {
  embedded?: boolean;
};

export type SetupListComponent = ComponentType<SetupListComponentProps>;
export type SetupCreateComponent = ComponentType<SetupCreateComponentProps>;
export type SetupEditComponent = ComponentType<SetupEditComponentProps>;
export type SetupCustomComponent = ComponentType<SetupCustomComponentProps>;

export type SetupItem = {
  key: string;
  label: string;
  description?: string;
  resource?: string;
  listComponent?: SetupListComponent;
  createComponent?: SetupCreateComponent;
  editComponent?: SetupEditComponent;
  customComponent?: SetupCustomComponent;
  externalResource?: string;
};
