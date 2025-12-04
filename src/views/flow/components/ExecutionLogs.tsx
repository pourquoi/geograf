import { NodeExecutionMessage } from "@/bindings/NodeExecutionMessage";
import useFlowStore from "../store";
import { cn, formatMicroseconds } from "@/lib/utils";
import { useShallow } from "zustand/react/shallow";
import React from "react";

const ExecutionLogs = ({
  nodeId,
  variant = "card",
  ...props
}: {
  nodeId: string;
  variant?: "card" | "form";
} & React.ComponentProps<"div">) => {
  const messages = useFlowStore(
    useShallow((state) => state.executions[nodeId]),
  );

  if (!messages) {
    return null;
  }

  return (
    <div className="w-full mt-2 flex-1 pointer-events-none">
      <div
        className={cn(
          "w-full font-mono pointer-events-auto whitespace-break-spaces bg-black text-white p-2 text-xs  overflow-auto",

          variant === "card" && "border-t-gray-500 border-t-1 rounded-b-[7px]",
          variant === "form" && "rounded-sm",
        )}
      >
        {messages.map((msg: NodeExecutionMessage, idx) => (
          <div key={`${msg.run_id}-${idx}`}>
            {msg.type === "Log" && (
              <div className="">
                {formatMicroseconds(msg.ts)} {msg.message}
              </div>
            )}
            {msg.type === "Queued" && (
              <>
                <div className="text-muted-foreground">{msg.run_id}</div>
                <div className="">{formatMicroseconds(msg.ts)} Queued</div>
              </>
            )}
            {msg.type === "Piped" && (
              <>
                <div className="text-muted-foreground">{msg.run_id}</div>
                <div>{formatMicroseconds(msg.ts)} Piped</div>
              </>
            )}
            {msg.type === "Start" && (
              <div className="">{formatMicroseconds(msg.ts)} Start</div>
            )}
            {msg.type === "Progress" && (
              <div className="">
                {formatMicroseconds(msg.ts)} {msg.progress}%
              </div>
            )}
            {msg.type === "Error" && (
              <div className="text-red-500">
                {formatMicroseconds(msg.ts)} Error: {msg.error}
              </div>
            )}
            {msg.type === "Success" && (
              <div className="text-green-500">
                {formatMicroseconds(msg.ts)} Success (
                {formatMicroseconds(msg.duration, 0, false)})
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ExecutionLogs;
