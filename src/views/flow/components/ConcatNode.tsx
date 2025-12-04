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
import { CheatsheetContext, CheatsheetProvider } from "./Cheatsheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import ExecutionLogs from "./ExecutionLogs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ConcatNodeData } from "@/bindings/ConcatNodeData";

export type ConcatNode = Node<ConcatNodeData, "ConcatNode">;

const ConcatNode = (props: NodeProps<ConcatNode>) => {
  const store = useFlowStore();

  const [showForm, setShowForm] = useState(false);

  const onDelete = () => {
    store.deleteNode(props.id);
  };

  const isFirstInputConnectable = !store.edges.find(
    (e) => e.target === props.id && e.targetHandle == "first",
  );
  const isSecondInputConnectable = !store.edges.find(
    (e) => e.target === props.id && e.targetHandle == "second",
  );

  return (
    <BaseNode className="min-w-[300px]">
      <Header
        nodeId={props.id}
        title={props.data.label}
        type="ConcatNode"
        onEdit={() => setShowForm(true)}
        onDelete={() => onDelete()}
        showTable={true}
        showDebug={true}
      />
      <LabeledHandle
        title="first"
        type="target"
        position={Position.Left}
        id="first"
        isConnectable={isFirstInputConnectable}
      />
      <LabeledHandle
        title="second"
        type="target"
        position={Position.Left}
        id="second"
        isConnectable={isSecondInputConnectable}
      />
      <BaseNodeContent className="mb-2">
        <div className="text-xs items-center grid gap-2 grid-cols-[min-content_1fr] gap-y-0">
          <div className="text-muted-foreground">Direction</div>
          <div className="font-mono">
            {props.data.horizontal ? "Horizontal" : "Vertical"}
          </div>
        </div>
      </BaseNodeContent>
      <LabeledHandle title="out" type="source" position={Position.Right} />
      <Footer nodeId={props.id} />

      <CheatsheetProvider>
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="sm:w-auto sm:max-w-[calc(100%-2rem)]">
            <DialogHeader>
              <DialogTitle>Concat settings</DialogTitle>
            </DialogHeader>
            <div className="flex flex-row gap-8">
              <ScrollArea className="max-h-[85vh] pt-5 overflow-y-auto overflow-x-visible flex-1 flex flex-col gap-2">
                <ConcatForm
                  className="flex-1 sm:w-[500px] sm:max-w-[700px]"
                  id={props.id}
                  data={props.data}
                  onSave={(values, close) => setShowForm(!close)}
                  onCancel={() => setShowForm(false)}
                />
              </ScrollArea>
              <CheatsheetContext className="pl-12 flex-1" />
            </div>
          </DialogContent>
        </Dialog>
      </CheatsheetProvider>
    </BaseNode>
  );
};

const ConcatForm = ({
  id,
  onSave,
  onCancel,
  data,
  ...props
}: {
  id: string;
  onSave: (values: ConcatNodeData, close?: boolean) => void;
  onCancel: () => void;
  data?: ConcatNodeData;
} & React.ComponentProps<"form">) => {
  const [showLogs, setShowLogs] = useState(false);
  const store = useFlowStore();
  const form = useForm({
    defaultValues:
      data ||
      ({
        horizontal: false,
      } as ConcatNodeData),
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
          <form.Field
            name="horizontal"
            children={(field) => (
              <Field>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="horizontal"
                    checked={field.state.value}
                    onCheckedChange={(e) =>
                      field.handleChange(e === "indeterminate" ? true : !!e)
                    }
                    onBlur={field.handleBlur}
                  />
                  <div className="grid gap-2">
                    <Label htmlFor="horizontal">Horizontal</Label>
                    <p className="text-muted-foreground text-sm">
                      Concat horizontally
                    </p>
                  </div>
                </div>
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

export default ConcatNode;
