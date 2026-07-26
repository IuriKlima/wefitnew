"use client";

import { Button, ErrorState } from "@gym-platform/ui";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="content">
      <ErrorState
        action={
          <Button tone="primary" onClick={reset}>
            Tentar novamente
          </Button>
        }
      />
    </main>
  );
}
