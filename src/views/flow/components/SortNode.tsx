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
import React, { useState } from "react";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useForm } from "@tanstack/react-form";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import Header from "./Header";
import Footer from "./Footer";
import { LuPencil } from "react-icons/lu";
import { LucideSortAsc, LucideSortDesc } from "lucide-react";
import ExecutionLogs from "./ExecutionLogs";

type SortNodeData = {
  label: string;
  by: { name: string; asc: boolean }[];
};

export type SortNode = Node<SortNodeData, "SortNode">;

const SortNode = (props: NodeProps<SortNode>) => {
  const store = useFlowStore();

  const [showForm, setShowForm] = useState(false);

  const onDelete = () => {
    store.deleteNode(props.id);
  };

  const isInputConnectable = !store.edges.find((e) => e.target === props.id);
  const isOutputConnectable = !store.edges.find((e) => e.source === props.id);

  return (
    <BaseNode className="min-w-[300px]">
      <Header
        nodeId={props.id}
        title={props.data.label}
        type="SortNode"
        onEdit={() => setShowForm(true)}
        onDelete={() => onDelete()}
        showTable={true}
      />
      <LabeledHandle
        title="in"
        type="target"
        position={Position.Left}
        isConnectable={isInputConnectable}
      />
      <BaseNodeContent className="mb-2">
        {props.data.by.length > 0 && props.data.by.some((by) => by.name) ? (
          <div className="text-xs items-center grid gap-2 grid-cols-[min-content_1fr] gap-y-0">
            {props.data.by.map((by, i) => (
              <React.Fragment key={i}>
                <div className="text-muted-foreground">By</div>
                <div className="font-mono">
                  {by.name} {by.asc ? "Asc" : "Desc"}
                </div>
              </React.Fragment>
            ))}
          </div>
        ) : (
          <Button
            className="mx-2"
            variant="outline"
            onClick={() => setShowForm(true)}
          >
            <LuPencil /> Setup
          </Button>
        )}
      </BaseNodeContent>
      <LabeledHandle
        title="out"
        type="source"
        position={Position.Right}
        isConnectable={isOutputConnectable}
      />
      <Footer nodeId={props.id} />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="">
          <DialogHeader>
            <DialogTitle>Sort settings</DialogTitle>
          </DialogHeader>
          <div className="w-full pt-5 h-full overflow-auto">
            <SortForm
              id={props.id}
              data={props.data}
              onSave={(values, close) => setShowForm(!close)}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </BaseNode>
  );
};

const SortForm = ({
  id,
  onSave,
  onCancel,
  data,
  ...props
}: {
  id: string;
  onSave: (values: SortNodeData, close?: boolean) => void;
  onCancel: () => void;
  data?: SortNodeData;
} & React.ComponentProps<"form">) => {
  const [showLogs, setShowLogs] = useState(false);
  const store = useFlowStore();
  const form = useForm({
    defaultValues:
      data ||
      ({
        label: "",
        by: [],
      } as SortNodeData),
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

  return (
    <form
      className={cn("grid items-start gap-2", props.className)}
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
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
            name="by"
            children={(field) => (
              <Field>
                <FieldLabel>Column names</FieldLabel>
                <div className="flex flex-col gap-2">
                  {field.state.value.map((by, i) => (
                    <form.Field
                      key={i}
                      name={`by[${i}]`}
                      children={(subField) => (
                        <div key={i} className="flex flex-row gap-2">
                          <Input
                            type="text"
                            className="font-mono"
                            value={by.name}
                            onChange={(e) =>
                              subField.handleChange({
                                ...by,
                                name: e.currentTarget.value,
                              })
                            }
                            onBlur={field.handleBlur}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="off"
                          />
                          {by.asc ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={() =>
                                subField.handleChange({ ...by, asc: false })
                              }
                            >
                              <LucideSortAsc />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              type="button"
                              onClick={() =>
                                subField.handleChange({ ...by, asc: true })
                              }
                            >
                              <LucideSortDesc />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => field.removeValue(i)}
                          >
                            -
                          </Button>
                        </div>
                      )}
                    />
                  ))}
                  <div className="flex justify-start">
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => field.pushValue({ asc: true, name: "" })}
                    >
                      + add sort
                    </Button>
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
                <Button type="button" variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={!canSubmit}
                  className="btn btn-primary"
                  onClick={() => form.handleSubmit({ run: false })}
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

export default SortNode;
