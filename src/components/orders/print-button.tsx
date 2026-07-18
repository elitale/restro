"use client";

import { Button } from "@/components/ui/button";

export function PrintButton({ label = "Print" }: { readonly label?: string }) {
  return (
    <Button variant="outline" className="print:hidden" onClick={() => window.print()}>
      {label}
    </Button>
  );
}
