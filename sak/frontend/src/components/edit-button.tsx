import React from "react";
import { buttonVariants } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import {
  useCreatePath,
  useRecordContext,
  useResourceContext,
  Translate,
  type RaRecord,
} from "ra-core";
import { Link, useLocation } from "react-router";

export type EditButtonProps = {
  record?: RaRecord;
  resource?: string;
  label?: string;
};

export const EditButton = (props: EditButtonProps) => {
  const resource = useResourceContext(props);
  const record = useRecordContext(props);
  const createPath = useCreatePath();
  const location = useLocation();
  const fromTodo = Boolean(location.state && (location.state as any).fromTodo);
  const link = createPath({
    resource,
    type: "edit",
    id: record?.id,
  });
  return (
    <Link
      className={buttonVariants({ variant: "outline" })}
      to={link}
      state={fromTodo ? { fromTodo: true } : undefined}
      onClick={stopPropagation}
    >
      <Pencil />
      <Translate i18nKey={props.label ?? "ra.action.edit"}>
        {props.label ?? "Edit"}
      </Translate>
    </Link>
  );
};

// useful to prevent click bubbling in a datagrid with rowClick
const stopPropagation = (e: React.MouseEvent) => e.stopPropagation();
