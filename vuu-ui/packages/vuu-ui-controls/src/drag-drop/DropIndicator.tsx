import { PortalDeprecated } from "@finos/vuu-popups";
import { forwardRef } from "react";
import { Rect } from "./dragDropTypesNext";

import "./DropIndicator.css";

export const DropIndicator = forwardRef<
  HTMLDivElement,
  { className?: string; rect: Rect }
>(function DropIndicator({ rect }, forwardedRef) {
  const { left, top, width, height } = rect;
  return (
    <PortalDeprecated>
      <div
        className={`vuuDropIndicator`}
        ref={forwardedRef}
        style={{ left, top, width, height }}
      />
    </PortalDeprecated>
  );
});
