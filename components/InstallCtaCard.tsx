"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RequestInstallForm } from "@/components/RequestInstallForm";

interface InstallCtaCardProps {
  analysisId: string;
}

export function InstallCtaCard({ analysisId }: InstallCtaCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <p className="text-muted-foreground mb-4">
            Want us to install your chosen layout? +$250 — we&apos;ll handle the
            setup and you get a 15-minute install call.
          </p>
          <Button variant="outline" onClick={() => setOpen(true)}>
            Request installation
          </Button>
        </CardContent>
      </Card>
      <RequestInstallForm
        open={open}
        onOpenChange={setOpen}
        analysisId={analysisId}
      />
    </>
  );
}
