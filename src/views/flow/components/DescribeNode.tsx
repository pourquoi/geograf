import { NodeProps, Node, Position } from "@xyflow/react";
import useFlowStore from "../store";
import { BaseNode, BaseNodeContent } from "@/components/base-node";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { LabeledHandle } from "@/components/labeled-handle";
import { useState } from "react";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useForm } from "@tanstack/react-form";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import Header from "./Header";
import Footer from "./Footer";
import { ScrollArea } from "@/components/ui/scroll-area";
import ExecutionLogs from "./ExecutionLogs";
import { DescribeNodeData } from "@/bindings/DescribeNodeData";
import { useNodeData } from "../hooks";
import { DEFAULT_READ_OPTIONS } from "../constants";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DescribeNode = Node<DescribeNodeData, "DescribeNode">;

const DescribeNode = (props: NodeProps<DescribeNode>) => {
  const store = useFlowStore();

  const [showForm, setShowForm] = useState(false);
  const [showData, setShowData] = useState(false);

  const onDelete = () => {
    store.deleteNode(props.id);
  };

  const run = async (debug?: boolean) => {
    setShowData(true);
  };

  const isInputConnectable = !store.edges.find((e) => e.target === props.id);

  return (
    <BaseNode className="min-w-[300px]">
      <Header
        nodeId={props.id}
        title={props.data.label}
        type="DescribeNode"
        onEdit={() => setShowForm(true)}
        onDelete={() => onDelete()}
        onRun={run}
        showDebug={true}
      />
      <LabeledHandle
        title="in"
        type="target"
        position={Position.Left}
        isConnectable={isInputConnectable}
      />
      <BaseNodeContent className="mb-2">
        <div className="text-xs items-center grid gap-2 grid-cols-[min-content_1fr] gap-y-0"></div>
      </BaseNodeContent>
      <LabeledHandle
        title="min"
        type="source"
        id="min"
        position={Position.Right}
      />
      <LabeledHandle
        title="max"
        type="source"
        id="max"
        position={Position.Right}
      />
      <LabeledHandle
        title="mean"
        type="source"
        id="mean"
        position={Position.Right}
      />
      <LabeledHandle
        title="std"
        type="source"
        id="std"
        position={Position.Right}
      />
      <LabeledHandle
        title="count"
        type="source"
        id="count"
        position={Position.Right}
      />
      <Footer nodeId={props.id} />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:w-auto sm:max-w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>Describe settings</DialogTitle>
          </DialogHeader>
          <div className="flex flex-row gap-8">
            <ScrollArea className="max-h-[85vh] pt-5 overflow-y-auto overflow-x-visible flex-1 flex flex-col gap-2">
              <DescribeForm
                className="flex-1 sm:w-[500px] sm:max-w-[700px]"
                id={props.id}
                data={props.data}
                onSave={(values, close) => setShowForm(!close)}
                onCancel={() => setShowForm(false)}
              />
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showData} onOpenChange={setShowData}>
        <DialogContent className="sm:w-auto sm:max-w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>{props.data.label || "Describe"}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-row gap-8">
            <ScrollArea className="max-h-[85vh] pt-5 overflow-y-auto overflow-x-visible flex-1 flex flex-col gap-2">
              <DescribeData enabled={showData} nodeId={props.id} />
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </BaseNode>
  );
};

const DescribeForm = ({
  id,
  onSave,
  onCancel,
  data,
  ...props
}: {
  id: string;
  onSave: (values: DescribeNodeData, close?: boolean) => void;
  onCancel: () => void;
  data?: DescribeNodeData;
} & React.ComponentProps<"form">) => {
  const [showLogs, setShowLogs] = useState(false);
  const store = useFlowStore();
  const form = useForm({
    defaultValues: data || ({} as DescribeNodeData),
    onSubmit: async ({ value, meta }) => {
      store.setNodes(
        store.nodes.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...value,
              },
            };
          } else {
            return n;
          }
        }),
      );
      await store.save();
      // @ts-ignore
      onSave(value, !meta?.run);
      // @ts-ignore
      if (meta?.run) {
        store.run(id);
        setShowLogs(true);
      }
    },
  });

  const onSubmitForm = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    form.handleSubmit();
  };

  return (
    <form
      className={cn("grid items-start gap-2", props.className)}
      onSubmit={onSubmitForm}
    >
      <div className="flex mb-4 flex-col gap-2">
        <FieldGroup>
          <form.Field
            name="label"
            children={(field) => (
              <Field>
                <FieldLabel>Label</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.currentTarget.value)}
                  onBlur={field.handleBlur}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
              </Field>
            )}
          />
        </FieldGroup>
        <div className="mt-2">
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            children={([canSubmit, isSubmitting]) => (
              <div className="flex flex-row gap-2 justify-end">
                <Button
                  type="button"
                  onClick={onCancel}
                  className="btn btn-secondary"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="btn btn-primary"
                >
                  {isSubmitting ? <Spinner /> : "Save"}
                </Button>
                <Button
                  type="submit"
                  onClick={() => form.handleSubmit({ run: true })}
                  disabled={!canSubmit}
                  className="btn btn-primary"
                >
                  {isSubmitting ? <Spinner /> : "Save & Run"}
                </Button>
              </div>
            )}
          />
        </div>
      </div>
      {showLogs && <ExecutionLogs variant="form" nodeId={id} />}
    </form>
  );
};

export default DescribeNode;

const DescribeData = ({
  enabled,
  nodeId,
}: {
  enabled: boolean;
  nodeId: string;
}) => {
  const minData = useNodeData(
    nodeId,
    { ...DEFAULT_READ_OPTIONS, output: "min" },
    enabled,
  );
  const maxData = useNodeData(
    nodeId,
    { ...DEFAULT_READ_OPTIONS, output: "max" },
    enabled,
  );
  const meanData = useNodeData(
    nodeId,
    { ...DEFAULT_READ_OPTIONS, output: "mean" },
    enabled,
  );
  const stdData = useNodeData(
    nodeId,
    { ...DEFAULT_READ_OPTIONS, output: "std" },
    enabled,
  );
  const countData = useNodeData(
    nodeId,
    { ...DEFAULT_READ_OPTIONS, output: "count" },
    enabled,
  );

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="text-center"></TableHead>
          <TableHead className="text-center">Min</TableHead>
          <TableHead className="text-center">Max</TableHead>
          <TableHead className="text-center">Mean</TableHead>
          <TableHead className="text-center">Std</TableHead>
          <TableHead className="text-center">Count</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {!!minData.data && (
          <>
            {minData.data.columns?.map((col) => (
              <TableRow key={col.name}>
                <TableCell className="text-sm bg-muted/50">
                  {minData.data.data.length > 0 ? col.name : ""}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-sm overflow-hidden max-w-[200px]">
                  {minData.data.data.length > 0 &&
                    minData.data.data[0][col.name]}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-sm overflow-hidden max-w-[200px]">
                  {maxData.data?.data.length > 0 &&
                    maxData.data?.data[0][col.name]}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-sm overflow-hidden max-w-[200px]">
                  {meanData.data?.data.length > 0 &&
                    meanData.data?.data[0][col.name]}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-sm overflow-hidden max-w-[200px]">
                  {stdData.data?.data.length > 0 &&
                    stdData.data?.data[0][col.name]}
                </TableCell>
                <TableCell className="text-muted-foreground font-mono text-sm overflow-hidden max-w-[200px]">
                  {countData.data?.data.length > 0 &&
                    countData.data?.data[0][col.name]}
                </TableCell>
              </TableRow>
            ))}
          </>
        )}
      </TableBody>
    </Table>
  );
};
