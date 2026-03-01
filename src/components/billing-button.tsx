"use client";

import { useClerk } from "@clerk/nextjs";
import { CrownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export const BillingButton = () => {
  const { openUserProfile } = useClerk();

  return (
    <Button
      variant="outline"
      className="h-6 px-2 text-[11px] gap-1"
      onClick={() => openUserProfile()}
    >
      <CrownIcon className="size-3" />
      Upgrade
    </Button>
  );
};
