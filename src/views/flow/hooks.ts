import { NodeExecutionMessage } from "@/bindings/NodeExecutionMessage";
import { listen } from "@tauri-apps/api/event";
import { RefObject, useEffect, useRef } from "react";
import useFlowStore from "./store";
import { toast } from "sonner";
import { formatMicroseconds } from "@/lib/utils";
import { readData } from "@/commands";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useFlow } from "../hub/hooks";
import { NodeReaderOptions } from "@/bindings/NodeReaderOptions";
import { DEBUG } from "./constants";

const NODE_EXECUTION_MESSAGE_NAME = "node_execution_message";

export const useMessageListener = () => {
  const { addNodeExecutionMessage } = useFlowStore();

  useEffect(() => {
    const unlisten = (async () => {
      return await listen<NodeExecutionMessage>(
        NODE_EXECUTION_MESSAGE_NAME,
        async (event) => {
          addNodeExecutionMessage(event.payload);
          // if (event.payload.type === "Error") {
          //   toast.error("Node execution error", {
          //     description: event.payload.error,
          //   });
          // } else if (event.payload.type === "Success") {
          //   toast.success("Node execution success", {
          //     description: formatMicroseconds(event.payload.duration, 0, false),
          //   });
          // }
        },
      );
    })();
    return () => {
      unlisten.then((unlisten) => unlisten());
    };
  }, []);
};

const NODE_DATA_KEY = "node_data";

export const useNodeData = (
  nodeId: string,
  options: NodeReaderOptions,
  enabled: boolean,
) => {
  const { flow } = useFlow();

  const query = useQuery({
    queryKey: [NODE_DATA_KEY, nodeId, JSON.stringify(options)],
    queryFn: async () => {
      return await readData(flow!, nodeId, options);
    },
    enabled: !!flow && enabled,
    placeholderData: keepPreviousData,
  });

  return query;
};

export const useDebugRender = (ref: RefObject<HTMLDivElement | null>) => {
  if (!DEBUG) return;
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (ref.current) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      ref.current.style.borderColor = "red";
      timeoutRef.current = setTimeout(() => {
        if (ref.current) {
          ref.current.style.borderColor = "";
        }
      }, 500);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  });
};
