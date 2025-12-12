import { NodeProps, Node, Position } from "@xyflow/react";
import useFlowStore from "../store";
import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog";
import { BaseNode, BaseNodeContent } from "@/components/base-node";
import { LabeledHandle } from "@/components/labeled-handle";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SinkNodeData } from "@/bindings/SinkNodeData";
import { useForm } from "@tanstack/react-form";
import Header from "./Header";
import Footer from "./Footer";
import { Label } from "@/components/ui/label";
import { LuPencil } from "react-icons/lu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DataFormat } from "@/bindings/DataFormat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { deleteNodeData } from "@/commands";

export type SinkNode = Node<SinkNodeData, "SinkNode">;

export default function SinkNode(props: NodeProps<SinkNode>) {
  const [showForm, setShowForm] = useState(false);

  const store = useFlowStore();

  const onDelete = useCallback(async () => {
    try {
      await deleteNodeData(store.id!, props.id);
    } catch (e) {
      console.error(e);
    }
    store.deleteNode(props.id);
  }, [store.id, props.id]);

  const isInputConnectable = !store.edges.find((e) => e.target === props.id);

  return (
    <BaseNode>
      <Header
        nodeId={props.id}
        title={props.data.label}
        type="SinkNode"
        showTable={true}
        onEdit={() => setShowForm(true)}
        onDelete={() => onDelete()}
        showFile={true}
      />
      <LabeledHandle
        title="in"
        type="target"
        position={Position.Left}
        isConnectable={isInputConnectable}
      />
      <BaseNodeContent>
        {props.data.format ? (
          <>
            <div className="text-xs grid gap-2 grid-cols-[min-content_1fr] gap-y-0">
              <div className="text-muted-foreground">Type</div>
              <div className="font-mono">{props.data.format.type}</div>
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
      <LabeledHandle title="out" type="source" position={Position.Right} />
      <Footer nodeId={props.id} />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="">
          <DialogHeader>
            <DialogTitle>Sink settings</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[85vh] pt-5 overflow-y-auto overflow-x-visible flex-1 flex flex-col gap-2">
            <SinkForm
              id={props.id}
              data={props.data}
              onSubmit={() => setShowForm(false)}
              onCancel={() => setShowForm(false)}
            />
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </BaseNode>
  );
}

type SinkFormValue = Omit<SinkNodeData, "options">;

const SinkForm = ({
  id,
  onSubmit,
  onCancel,
  data,
  ...props
}: {
  id: string;
  onSubmit: (values: SinkNodeData) => void;
  onCancel: () => void;
  data?: SinkNodeData;
} & React.ComponentProps<"form">) => {
  const store = useFlowStore();
  const form = useForm({
    defaultValues:
      (data as SinkFormValue) ||
      ({
        label: "",
        format: { type: "Csv", comma_delimiter: true },
        dest: "",
        limit: null,
      } as SinkFormValue),
    onSubmit: async (value) => {
      let data = { ...value.value, dest: "", file: undefined };
      store.setNodes(
        store.nodes.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data,
            };
          } else {
            return n;
          }
        }),
      );
      await store.save();
      onSubmit(value.value as SinkNodeData);
      await store.run(id);
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
          <Field>
            <FieldLabel>Format</FieldLabel>
            <form.Field
              name="format"
              children={(field) => (
                <Select
                  name={field.name}
                  value={field.state.value.type}
                  onValueChange={(e) =>
                    field.handleChange({
                      ...field.state.value,
                      type: e,
                    } as DataFormat)
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select the format" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Csv">CSV</SelectItem>
                    <SelectItem value="Json">JSON</SelectItem>
                    <SelectItem value="Jsonl">JSONL</SelectItem>
                    <SelectItem value="Parquet">Parquet</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <form.Subscribe selector={(state) => state.values.format}>
              {(format) => {
                if (format.type === "Csv") {
                  return (
                    <form.Field
                      name="format"
                      children={(field) => (
                        <RadioGroup
                          className="pl-2"
                          defaultValue="0"
                          value={
                            (field.state.value as DataFormat & { type: "Csv" })
                              .comma_delimiter
                              ? "1"
                              : "0"
                          }
                          onValueChange={(e) =>
                            field.handleChange({
                              ...field.state.value,
                              comma_delimiter: e == "1" ? true : false,
                            } as DataFormat & { type: "Csv" })
                          }
                        >
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value="1" id="r1" />
                            <Label htmlFor="r1">Comma separators</Label>
                          </div>
                          <div className="flex items-center gap-3">
                            <RadioGroupItem value="0" id="r2" />
                            <Label htmlFor="r2">Semicolon separators</Label>
                          </div>
                        </RadioGroup>
                      )}
                    />
                  );
                }
                return null;
              }}
            </form.Subscribe>
          </Field>
          <Field>
            <FieldLabel>Limit</FieldLabel>
            <form.Field
              name="limit"
              children={(field) => (
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value || ""}
                  type="number"
                  min={0}
                  step={1}
                  onChange={(e) =>
                    field.handleChange(Number(e.currentTarget.value))
                  }
                  onBlur={field.handleBlur}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
              )}
            />
          </Field>
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
              </div>
            )}
          />
        </div>
      </div>
    </form>
  );
};
