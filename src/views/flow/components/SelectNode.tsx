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
import { Checkbox } from "@/components/ui/checkbox";
import { LabeledHandle } from "@/components/labeled-handle";
import React, { useState } from "react";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useForm } from "@tanstack/react-form";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import Header from "./Header";
import Footer from "./Footer";
import { LuPencil } from "react-icons/lu";
import { checkSyntax } from "@/commands";
import { SYNTAX_CHECK_DELAY } from "../constants";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  CheatsheetContext,
  CheatsheetContextTrigger,
  CheatsheetProvider,
} from "./Cheatsheet";
import ExecutionLogs from "./ExecutionLogs";
import { ScrollArea } from "@/components/ui/scroll-area";

type SelectNodeData = {
  label: string;
  exprs: string[];
  with_columns: boolean;
};

export type SelectNode = Node<SelectNodeData, "SelectNode">;

const SelectNode = (props: NodeProps<SelectNode>) => {
  const store = useFlowStore();

  const [showForm, setShowForm] = useState(false);

  const onDelete = () => {
    store.deleteNode(props.id);
  };

  const isInputConnectable = !store.edges.find((e) => e.target === props.id);
  const isOutputConnectable = true;

  return (
    <BaseNode className="min-w-[300px]">
      <Header
        nodeId={props.id}
        title={props.data.label}
        type="SelectNode"
        onEdit={() => setShowForm(true)}
        onDelete={() => onDelete()}
        showTable={true}
        showDebug={true}
      />
      <LabeledHandle
        title="in"
        type="target"
        position={Position.Left}
        isConnectable={isInputConnectable}
      />
      <BaseNodeContent className="mb-2">
        {props.data.exprs.length > 0 &&
        props.data.exprs.some((expr) => expr !== "") ? (
          <>
            <div className="text-xs overflow-hidden items-center grid gap-2 grid-cols-[min-content_1fr] gap-y-0">
              {props.data.exprs.map((expr, i) => (
                <React.Fragment key={i}>
                  <div className="text-muted-foreground">Expr</div>
                  <div className="font-mono whitespace-pre">{expr}</div>
                </React.Fragment>
              ))}
              <div className="text-muted-foreground">Append</div>
              <div className="font-mono">
                {props.data.with_columns ? "yes" : "no"}
              </div>
            </div>
          </>
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

      <CheatsheetProvider>
        <Dialog open={showForm} onOpenChange={setShowForm} modal={false}>
          <DialogContent className="sm:w-auto sm:max-w-[calc(100%-2rem)]">
            <DialogHeader>
              <DialogTitle>Select settings</DialogTitle>
            </DialogHeader>
            <div className="flex flex-row gap-8">
              <ScrollArea className="max-h-[85vh] pt-5 overflow-y-auto overflow-x-visible flex-1 flex flex-col gap-2">
                <SelectForm
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

const SelectForm = ({
  id,
  onSave,
  onCancel,
  data,
  ...props
}: {
  id: string;
  onSave: (values: SelectNodeData, close?: boolean) => void;
  onCancel: () => void;
  data?: SelectNodeData;
} & React.ComponentProps<"form">) => {
  const [showLogs, setShowLogs] = useState(false);
  const store = useFlowStore();
  const form = useForm({
    defaultValues:
      data ||
      ({
        label: "",
        exprs: [],
        with_columns: false,
      } as SelectNodeData),
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
            name="exprs"
            children={(field) => (
              <Field>
                <FieldLabel>Expressions</FieldLabel>
                <div className="flex flex-col gap-2">
                  {field.state.value.map((expr, i) => (
                    <form.Field
                      key={i}
                      name={`exprs[${i}]`}
                      validators={{
                        onChangeAsync: async ({ value }) => {
                          if (value) return await checkSyntax(value);
                        },
                        onChangeAsyncDebounceMs: SYNTAX_CHECK_DELAY,
                      }}
                      children={(subField) => (
                        <div>
                          <div
                            key={i}
                            className="grid grid-cols-[1fr_min-content] w-full flex-row gap-2 gap-y-0 items-center"
                          >
                            <InputGroup>
                              <InputGroupAddon align="inline-end">
                                <CheatsheetContextTrigger />
                              </InputGroupAddon>
                              <InputGroupInput
                                className={cn(
                                  "w-full font-mono",
                                  subField.state.meta.errors.length > 0 && "",
                                )}
                                value={expr}
                                onChange={(e) =>
                                  subField.handleChange(e.currentTarget.value)
                                }
                                onBlur={field.handleBlur}
                                autoComplete="off"
                                autoCorrect="off"
                                autoCapitalize="off"
                              />
                            </InputGroup>

                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => field.removeValue(i)}
                            >
                              -
                            </Button>
                            {subField.state.meta.errors.length > 0 && (
                              <div className="p-2 text-red-500 text-xs font-mono whitespace-pre overflow-x-auto">
                                {subField.state.meta.errors.join(", ")}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    />
                  ))}
                  <div className="flex justify-start">
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      onClick={() => field.pushValue("")}
                    >
                      + add expression
                    </Button>
                  </div>
                </div>
              </Field>
            )}
          />
          <form.Field
            name="with_columns"
            children={(field) => (
              <Field>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="with_columns"
                    checked={field.state.value}
                    onCheckedChange={(e) =>
                      field.handleChange(e === "indeterminate" ? true : e)
                    }
                    onBlur={field.handleBlur}
                  />
                  <div className="grid gap-2">
                    <Label htmlFor="with_columns">Append</Label>
                    <p className="text-muted-foreground text-sm">
                      Append input columns to the output
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
                <Button type="button" variant="ghost" onClick={onCancel}>
                  Cancel
                </Button>

                <Button
                  type="submit"
                  onClick={() => form.handleSubmit()}
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

export default SelectNode;
