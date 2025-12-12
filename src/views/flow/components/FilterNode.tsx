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
import { LuPencil } from "react-icons/lu";
import { SYNTAX_CHECK_DELAY } from "../constants";
import { checkSyntax } from "@/commands";
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
import { ScrollArea } from "@radix-ui/react-scroll-area";
import ExecutionLogs from "./ExecutionLogs";
import { cheatsheetContext } from "./Cheatsheet";

type FilterNodeData = {
  label: string;
  expr: string;
};

export type FilterNode = Node<FilterNodeData, "FilterNode">;

const FilterNode = (props: NodeProps<FilterNode>) => {
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const store = useFlowStore();

  const [showForm, setShowForm] = useState(false);

  const onDelete = () => {
    store.deleteNode(props.id);
  };

  const isInputConnectable = !store.edges.find((e) => e.target === props.id);

  return (
    <BaseNode>
      <Header
        nodeId={props.id}
        title={props.data.label}
        type="FilterNode"
        onEdit={() => setShowForm(true)}
        onDelete={() => onDelete()}
        showTable={true}
        showDebug={true}
      />
      <LabeledHandle
        title="in"
        type="target"
        isConnectable={isInputConnectable}
        position={Position.Left}
      />
      <BaseNodeContent className="mb-2">
        {props.data.expr ? (
          <div className="text-xs items-center grid gap-2 grid-cols-[min-content_1fr] gap-y-0">
            <div className="text-muted-foreground">Expr</div>
            <div className="font-mono">{props.data.expr}</div>
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

      <LabeledHandle title="out" type="source" position={Position.Right} />

      <Footer nodeId={props.id} />

      <cheatsheetContext.Provider
        value={{
          open: cheatsheetOpen,
          setOpen: setCheatsheetOpen,
          toggle: () => setCheatsheetOpen(!cheatsheetOpen),
        }}
      >
        <Dialog open={showForm} onOpenChange={setShowForm} modal={false}>
          <DialogContent className="sm:w-auto sm:max-w-[calc(100%-2rem)]">
            <DialogHeader>
              <DialogTitle>Source settings</DialogTitle>
            </DialogHeader>
            <ScrollArea
              className={cn(
                "max-h-dvh-safe-[85dvh] max-w-screen pt-2 overflow-y-auto overflow-x-visible flex-1 flex flex-col md:gap-2",
              )}
            >
              <FilterForm
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

const FilterForm = ({
  id,
  onSave,
  onCancel,
  data,
  ...props
}: {
  id: string;
  onSave: (values: FilterNodeData, close?: boolean) => void;
  onCancel: () => void;
  data?: FilterNodeData;
} & React.ComponentProps<"form">) => {
  const [showLogs, setShowLogs] = useState(false);
  const store = useFlowStore();
  const form = useForm({
    defaultValues:
      data ||
      ({
        label: "",
        expr: "",
      } as FilterNodeData),
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
            name="expr"
            validators={{
              onChangeAsync: async ({ value }) => {
                if (value) return await checkSyntax(value);
              },
              onChangeAsyncDebounceMs: SYNTAX_CHECK_DELAY,
            }}
            children={(field) => (
              <Field>
                <FieldLabel>Filter expression</FieldLabel>
                <div className="flex flex-col">
                  <InputGroup>
                    <InputGroupAddon align="inline-end">
                      <CheatsheetContextTrigger />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="text"
                      className={cn(
                        "w-full font-mono",
                        field.state.meta.errors.length > 0 && "rounded-b-none",
                      )}
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onChange={(e) =>
                        field.handleChange(e.currentTarget.value)
                      }
                      onBlur={field.handleBlur}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                    />
                  </InputGroup>
                  {field.state.meta.errors.length > 0 && (
                    <div className="text-red-500 bg-black text-xs font-mono whitespace-pre overflow-x-auto">
                      {field.state.meta.errors.join(", ")}
                    </div>
                  )}
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

export default FilterNode;
