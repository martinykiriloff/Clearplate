import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select
        data-slot="native-select"
        className={cn(
          "h-12 w-full appearance-none rounded-md border border-input bg-background pr-10 pl-3.5 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
          className,
        )}
        {...props}
      />
      <ChevronDownIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { NativeSelect };
