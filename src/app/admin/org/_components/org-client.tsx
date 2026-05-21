"use client";

import { useState, useCallback } from "react";
import { OrgTree } from "./org-tree";
import type { BusinessUnitRow } from "./types";

interface Props {
  initial: BusinessUnitRow[];
}

export function OrgClient({ initial }: Props) {
  const [units, setUnits] = useState<BusinessUnitRow[]>(initial);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/business-units");
    if (res.ok) {
      const data = await res.json() as BusinessUnitRow[];
      setUnits(data);
    }
  }, []);

  return <OrgTree units={units} onRefresh={refresh} />;
}
