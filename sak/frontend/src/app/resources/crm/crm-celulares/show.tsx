"use client";

import { useEffect } from "react";
import { useRecordContext, useRedirect } from "ra-core";

export const CRMCelularShow = () => {
  const record = useRecordContext();
  const redirect = useRedirect();

  useEffect(() => {
    if (record?.id) {
      redirect("edit", "crm/celulares", record.id);
    }
  }, [record, redirect]);

  return null;
};

