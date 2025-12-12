import { Node, NodeProps, Position } from "@xyflow/react";
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
import { checkSyntax } from "@/commands";
import { SYNTAX_CHECK_DELAY } from "../constants";
import {
  CheatsheetContext,
  CheatsheetContextTrigger,
  CheatsheetProvider,
} from "./Cheatsheet";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import ExecutionLogs from "./ExecutionLogs";
import { cheatsheetContext } from "./Cheatsheet";

type GroupByNodeData = {
  label: string;
  exprs: string[];
  aggrs: string[];
};

export type GroupByNode = Node<GroupByNodeData, "GroupByNode">;
const GroupByNode = (props: NodeProps<GroupByNode>) => {
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
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
        type="GroupByNode"
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
        {props.data.exprs.length > 0 ? (
          <div className="text-xs items-center grid gap-2 grid-cols-[min-content_1fr] gap-y-0">
            {props.data.exprs.map((expr, i) => (
              <React.Fragment key={i}>
                <div className="text-muted-foreground">On</div>
                <div className="font-mono">{expr}</div>
              </React.Fragment>
            ))}
            {props.data.aggrs.map((aggr, i) => (
              <React.Fragment key={i}>
                <div className="text-muted-foreground">Aggregate</div>
                <div className="font-mono">{aggr}</div>
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

      <cheatsheetContext.Provider
        value={{
          open: cheatsheetOpen,
          setOpen: setCheatsheetOpen,
          toggle: () => setCheatsheetOpen(!cheatsheetOpen),
        }}
      >
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="w-screen px-2 sm:px-6 max-w-screen sm:h-auto sm:rounded-lg sm:w-auto sm:max-w-[calc(100vw-2rem)]">
            <DialogHeader>
              <DialogTitle>GroupBy settings</DialogTitle>
            </DialogHeader>
            <ScrollArea
              className={cn(
                "max-h-dvh-safe-[85dvh] max-w-screen pt-2 overflow-y-auto overflow-x-visible flex-1 flex flex-col md:gap-2",
              )}
            >
              <GroupByForm
                className="flex-1 sm:w-[500px] sm:max-w-[700px]"
                id={props.id}
                data={props.data}
                onSave={(values, close) => setShowForm(!close)}
                onCancel={() => setShowForm(false)}
              />
            </ScrollArea>
            <Dialog open={cheatsheetOpen} onOpenChange={setCheatsheetOpen}>
              <DialogContent className="px-0 sm:px-6">
                <CheatsheetContext />
              </DialogContent>
            </Dialog>
          </DialogContent>
        </Dialog>
      </cheatsheetContext.Provider>
    </BaseNode>
  );
};

const GroupByForm = ({
  id,
  onSave,
  onCancel,
  data,
  ...props
}: {
  id: string;
  onSave: (values: GroupByNodeData, close?: boolean) => void;
  onCancel: () => void;
  data?: GroupByNodeData;
} & React.ComponentProps<"form">) => {
  const [showLogs, setShowLogs] = useState(false);
  const store = useFlowStore();
  const form = useForm({
    defaultValues:
      data ||
      ({
        label: "",
        exprs: [],
        aggrs: [],
      } as GroupByNodeData),
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
            name="exprs"
            children={(field) => (
              <Field>
                <FieldLabel>Group by expressions</FieldLabel>
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
                        <div
                          key={i}
                          className="grid grid-cols-[1fr_min-content] w-full flex-row gap-2 gap-y-0 items-center"
                        >
                          <InputGroup>
                            <InputGroupAddon align="inline-end">
                              <CheatsheetContextTrigger />
                            </InputGroupAddon>
                            <InputGroupInput
                              type="text"
                              className={cn(
                                "w-full font-mono",
                                subField.state.meta.errors.length > 0 &&
                                  "rounded-b-none",
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
                            <div className="text-red-500 bg-black text-xs font-mono whitespace-pre overflow-x-auto">
                              {subField.state.meta.errors.join(", ")}
                            </div>
                          )}
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
                      + add group by
                    </Button>
                  </div>
                </div>
              </Field>
            )}
          />
          <form.Field
            name="aggrs"
            children={(field) => (
              <Field>
                <FieldLabel>Aggregate expressions</FieldLabel>
                <div className="flex flex-col gap-2">
                  {field.state.value.map((aggr, i) => (
                    <form.Field
                      key={i}
                      name={`aggrs[${i}]`}
                      validators={{
                        onChangeAsync: async ({ value }) => {
                          if (value) return await checkSyntax(value);
                        },
                        onChangeAsyncDebounceMs: SYNTAX_CHECK_DELAY,
                      }}
                      children={(subField) => (
                        <div
                          key={i}
                          className="grid grid-cols-[1fr_min-content] w-full flex-row gap-2 gap-y-0 items-center"
                        >
                          <InputGroup>
                            <InputGroupAddon align="inline-end">
                              <CheatsheetContextTrigger />
                            </InputGroupAddon>
                            <InputGroupInput
                              type="text"
                              className={cn(
                                "w-full font-mono",
                                subField.state.meta.errors.length > 0 &&
                                  "rounded-b-none",
                              )}
                              value={aggr}
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
                            <div className="text-red-500 bg-black text-xs font-mono whitespace-pre overflow-x-auto">
                              {subField.state.meta.errors.join(", ")}
                            </div>
                          )}
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
                      + add aggregation
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

export default GroupByNode;
