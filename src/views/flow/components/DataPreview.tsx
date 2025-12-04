import { Button } from "@/components/ui/button";
import React, { useEffect, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import useFlowStore from "../store";
import { LuScanEye } from "react-icons/lu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NodeReadOutput } from "@/bindings/NodeReadOutput";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useShallow } from "zustand/react/shallow";
import { nodeIcons } from "../Flow";
import { DataValueDisplay } from "./DataTable";

const DataPreview = ({ nodeId }: { nodeId: string }) => {
  const [node, preview] = useFlowStore(
    useShallow((state) => [
      state.nodes.find((n) => n.id === nodeId),
      state.previews[nodeId],
    ]),
  );
  const store = useFlowStore();
  const [open, setOpen] = useState(false);
  const [table, setTable] = useState<NodeReadOutput | null>(null);

  useEffect(() => {
    if (preview && preview.status === "success") {
      setTable(preview.output || null);
    }
  }, [preview]);

  const onOpen = () => {
    if (!node) {
      return;
    }
    if (!preview) {
      store.run(nodeId);
    }
    setOpen(true);
  };

  return (
    <>
      <Button variant="outline" size="icon" onClick={() => onOpen?.()}>
        <Tooltip>
          <TooltipTrigger>
            <LuScanEye />
          </TooltipTrigger>
          <TooltipContent>
            <p>Preview sample</p>
          </TooltipContent>
        </Tooltip>
      </Button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="!max-w-screen max-h-[50vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center justify-center gap-2">
              {React.createElement(
                nodeIcons[node?.data?.type || "SourceNode"],
                {
                  className: "w-5 h-5",
                },
              )}
              <span>Sample {node?.data?.label || "Data table"}</span>
            </DrawerTitle>
            <DrawerDescription className="text-xs flex justify-center gap-2 items-center">
              <span>To explore the full dataset create a sink node.</span>
            </DrawerDescription>
          </DrawerHeader>
          {preview && preview.status === "loading" && (
            <div className="flex justify-center items-center">
              <Spinner />
            </div>
          )}
          {preview && preview.status === "success" && table && (
            <Table>
              <TableHeader>
                <TableRow>
                  {table.columns?.map((col) => (
                    <TableHead key={col.name}>
                      {col.name}
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {col.dtype}
                      </span>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.data.map((row: any, rowIdx: number) => (
                  <TableRow key={rowIdx}>
                    {table.columns?.map((col) => (
                      <TableCell key={col.name}>
                        <DataValueDisplay value={row[col.name]} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {preview.status === "error" && (
            <Alert variant="destructive" className="w-auto mx-auto self-start">
              <AlertCircleIcon />
              <AlertTitle>Error loading sample</AlertTitle>
              <AlertDescription>
                {preview.errors && preview.errors.length > 0 && (
                  <ul>
                    {preview.errors!.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}

          <DrawerFooter className="flex sm:items-center text-sm">
            {preview?.output?.total && (
              <>
                {preview.output.data?.length} of {preview.output.total} records
              </>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default DataPreview;
