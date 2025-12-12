import { useRef, type ComponentProps } from "react";

import { cn } from "@/lib/utils";
import { useDebugRender } from "@/views/flow/hooks";
import { useReactFlow } from "@xyflow/react";

export function BaseNode({ className, ...props }: ComponentProps<"div">) {
  const debugRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitBounds } = useReactFlow();
  useDebugRender(debugRef);

  const zoomNode = (e: React.MouseEvent<HTMLDivElement>) => {
    console.log("zoomNode");
    const node = e.currentTarget.closest(".react-flow__node");
    if (!node) return;
    const nodeId = node.getAttribute("data-node-id");
    if (!nodeId) return;
    const nodePosition = screenToFlowPosition(
      e.currentTarget.getBoundingClientRect(),
    );
    fitBounds(
      { x: nodePosition.x, y: nodePosition.y, width: 300, height: 200 },
      { duration: 300, padding: 0.2 },
    );
  };

  return (
    <div
      ref={debugRef}
      onDoubleClick={zoomNode}
      className={cn(
        "bg-card text-card-foreground relative rounded-md border",
        "hover:ring-1",
        // React Flow displays node elements inside of a `NodeWrapper` component,
        // which compiles down to a div with the class `react-flow__node`.
        // When a node is selected, the class `selected` is added to the
        // `react-flow__node` element. This allows us to style the node when it
        // is selected, using Tailwind's `&` selector.
        "[.react-flow\\_\\_node.selected_&]:border-muted-foreground",
        "[.react-flow\\_\\_node.selected_&]:shadow-lg",
        "min-w-[300px]",
        "max-w-[550px]",
        className,
      )}
      tabIndex={0}
      {...props}
    />
  );
}

/**
 * A container for a consistent header layout intended to be used inside the
 * `<BaseNode />` component.
 */
export function BaseNodeHeader({
  className,
  ...props
}: ComponentProps<"header">) {
  const debugRef = useRef<HTMLDivElement>(null);
  useDebugRender(debugRef);

  return (
    <header
      ref={debugRef}
      {...props}
      className={cn(
        "mx-0 my-0 -mb-1 flex flex-row items-center justify-between gap-2 px-3 py-2",
        // Remove or modify these classes if you modify the padding in the
        // `<BaseNode />` component.
        className,
      )}
    />
  );
}

/**
 * The title text for the node. To maintain a native application feel, the title
 * text is not selectable.
 */
export function BaseNodeHeaderTitle({
  className,
  ...props
}: ComponentProps<"h3">) {
  return (
    <h3
      data-slot="base-node-title"
      className={cn("user-select-none flex-1 font-semibold", className)}
      {...props}
    />
  );
}

export function BaseNodeContent({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      data-slot="base-node-content"
      className={cn("flex flex-col gap-y-2 p-3 pb-0", className)}
      {...props}
    />
  );
}

export function BaseNodeFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="base-node-footer"
      className={cn(
        "flex flex-col items-center gap-y-2 border-t px-3 pt-2 pb-3",
        className,
      )}
      {...props}
    />
  );
}
