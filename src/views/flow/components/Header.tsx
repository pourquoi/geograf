import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontalIcon } from "lucide-react";
import { LuBugPlay, LuPencil, LuPlay } from "react-icons/lu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { BaseNodeHeader, BaseNodeHeaderTitle } from "@/components/base-node";
import {
  NodeTypes,
  useReactFlow,
  useStore as useReactFlowStore,
} from "@xyflow/react";
import { nodeIcons } from "../Flow";
import useFlowStore from "../store";
import DataPreview from "./DataPreview";
import { useShallow } from "zustand/react/shallow";
import { Spinner } from "@/components/ui/spinner";
import { v4 as uuidv4 } from "uuid";
import { NodeExecutorOptions } from "@/bindings/NodeExecutorOptions";
import { executeNode, hasNodeFile, openNodeFile } from "@/commands";
import { cn } from "@/lib/utils";
import { DataTableDialog } from "./DataTable";
import { AlertDialogTitle } from "@radix-ui/react-alert-dialog";
import { useFlow } from "@/views/hub/hooks";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NodeExecutionMessage } from "@/bindings/NodeExecutionMessage";
import { useLastNodeMessageListener } from "../hooks";
import { invoke } from "@tauri-apps/api/core";
import { DataFormat } from "@/bindings/DataFormat";
import { downloadStreamedFile } from "@/lib/download";
import { platform } from "@tauri-apps/plugin-os";
import { openPath, openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";

type Props = {
  nodeId: string;
  title: string;
  type: keyof NodeTypes | undefined;
  menuItems?: ({ label: string; onClick: () => void } | "separator")[];
  showRun?: boolean;
  showEdit?: boolean;
  showDelete?: boolean;
  showDuplicate?: boolean;
  showDebug?: boolean;
  showTable?: boolean;
  showFile?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  onRun?: (debug?: boolean) => void;
};

const Header = ({
  nodeId,
  title,
  type,
  menuItems,
  showRun = true,
  showEdit = true,
  showDelete = true,
  showDuplicate = true,
  showTable = false,
  showDebug = false,
  showFile = false,
  onRun,
  onEdit,
  onDelete,
  onDuplicate,
}: Props) => {
  const { flow } = useFlow();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const lastMessage = useLastNodeMessageListener(nodeId);
  const [file, setFile] = useState<[string, DataFormat] | null>(null);

  const { setCenter } = useReactFlow();
  const resetSelectedElements = useReactFlowStore(
    (state) => state.resetSelectedElements,
  );
  const addSelectedNodes = useReactFlowStore((state) => state.addSelectedNodes);

  const [getNode, addNode] = useFlowStore(
    useShallow((state) => [state.getNode, state.addNode]),
  );

  // todo: review this shit and move to store
  const [isRunning, preview] = useFlowStore(
    useShallow((state) => {
      const executions = state.executions;
      const isRunning =
        executions[nodeId] &&
        executions[nodeId].length > 0 &&
        (["Queued", "Start"].includes(
          executions[nodeId][executions[nodeId].length - 1].type,
        ) ||
          (executions[nodeId][executions[nodeId].length - 1].type ===
            "Progress" &&
            (
              executions[nodeId][
                executions[nodeId].length - 1
              ] as NodeExecutionMessage & { progress: number }
            ).progress != 100));
      const preview = state.previews[nodeId];
      return [isRunning, preview];
    }),
  );

  const duplicate = useCallback(() => {
    const node = getNode(nodeId);
    if (!node) {
      return;
    }
    const position = {
      x: node.position.x + 350,
      y: node.position.y + 150,
    };
    const newNode = {
      id: uuidv4(),
      data: { ...node.data },
      type: node.type,
      position,
    };
    addNode(newNode);
    onDuplicate?.();
    setTimeout(() => {
      setCenter(position.x + 175, position.y + 100, { duration: 300 });
      resetSelectedElements();
      addSelectedNodes([newNode.id]);
    });
  }, [
    onDuplicate,
    setCenter,
    resetSelectedElements,
    addSelectedNodes,
    getNode,
  ]);

  useEffect(() => {
    if (!showFile) {
      return;
    }
    (async () => {
      let hasFile = null;
      try {
        hasFile = await hasNodeFile(flow!, nodeId);
      } catch (e) {
        console.log(e);
      }
      setFile(hasFile);
    })();
  }, [showFile, nodeId, flow, lastMessage]);

  const run = async (debug: boolean) => {
    if (onRun) {
      onRun(debug);
    } else if (flow) {
      const options = {
        diagnostic: debug,
        run_id: uuidv4(),
        page: 1,
        page_size: 100,
      };
      await executeNode(flow, nodeId, options);
    }
  };

  const downloadFile = async () => {
    if (!file) return;
    if (platform() === "android" || platform() === "ios") {
      try {
        await downloadStreamedFile(file[0]);
      } catch (e) {
        console.error(e);
        alert(e);
      }
    } else {
      revealItemInDir(file[0]);
    }
  };

  const icon = nodeIcons[type || "SourceNode"];

  return (
    <>
      <BaseNodeHeader>
        <BaseNodeHeaderTitle className="flex items-center gap-2 text-lg">
          <>{React.createElement(icon, { className: "w-5 h-5" })}</>
          {title}
          <div className="flex-1" />
          <ButtonGroup>
            {showDebug && (
              <>
                <Button
                  variant="outline"
                  className={cn(
                    showDebug && "text-green-700 hover:text-green-500",
                  )}
                  disabled={isRunning}
                  size="icon"
                  onClick={() => run(true)}
                >
                  <Tooltip>
                    <TooltipTrigger>
                      {isRunning ? <Spinner /> : <LuBugPlay />}
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Run Debug</p>
                    </TooltipContent>
                  </Tooltip>
                </Button>
              </>
            )}
            {showRun && (
              <>
                <Button
                  variant="outline"
                  className={cn(
                    !showDebug && "text-green-700 hover:text-green-500",
                  )}
                  disabled={isRunning}
                  size="icon"
                  onClick={() => run(false)}
                >
                  <Tooltip>
                    <TooltipTrigger>
                      {isRunning ? <Spinner /> : <LuPlay />}
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Run</p>
                    </TooltipContent>
                  </Tooltip>
                </Button>
              </>
            )}
            {/* {!!preview && showPreview && <DataPreview nodeId={nodeId} />} */}
            {showTable && <DataTableDialog nodeId={nodeId} />}
            {showEdit && (
              <Button variant="outline" size="icon" onClick={() => onEdit?.()}>
                <Tooltip>
                  <TooltipTrigger>
                    <LuPencil />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Edit</p>
                  </TooltipContent>
                </Tooltip>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="icon">
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="z-250">
                <DropdownMenuGroup>
                  {menuItems?.map((item) => {
                    if (item === "separator") {
                      return <DropdownMenuSeparator />;
                    } else {
                      return (
                        <DropdownMenuItem onClick={item.onClick}>
                          {item.label}
                        </DropdownMenuItem>
                      );
                    }
                  })}
                  {showFile && file && (
                    <DropdownMenuItem onClick={() => downloadFile()}>
                      {platform() === "android" || platform() === "ios"
                        ? "Download"
                        : "Open"}
                    </DropdownMenuItem>
                  )}
                  {showDuplicate && (
                    <DropdownMenuItem onClick={() => duplicate()}>
                      Duplicate
                    </DropdownMenuItem>
                  )}
                  {showDelete && (
                    <>
                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        onClick={() => setShowDeleteDialog(true)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        </BaseNodeHeaderTitle>
      </BaseNodeHeader>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>Delete node</AlertDialogTitle>
          <AlertDialogHeader>
            <AlertDialogDescription>
              Are you sure you want to delete this node?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete?.()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default memo(Header);
