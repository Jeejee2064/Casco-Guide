"use client";

import { useEffect } from "react";
import { loadPosthog } from "@/lib/analytics/posthog-client";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    void loadPosthog().then((posthog) => posthog?.captureException(error));
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main>
          <h1>Something went wrong</h1>
          <p>Please try again. If the problem persists, return later.</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
