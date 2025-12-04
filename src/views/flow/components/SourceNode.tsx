import { NodeProps, Node, Position } from "@xyflow/react";
import useFlowStore from "../store";
import { memo, useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogHeader,
} from "@/components/ui/dialog";
import { BaseNode, BaseNodeContent } from "@/components/base-node";
import { deleteNodeData, pickFile } from "@/commands";
import { LabeledHandle } from "@/components/labeled-handle";
import { useForm } from "@tanstack/react-form";
import { SourceNodeData } from "@/bindings/SourceNodeData";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn, isHttpUrl, middleTruncate } from "@/lib/utils";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Header from "./Header";
import Footer from "./Footer";
import { useShallow } from "zustand/react/shallow";
import { LuFolderSearch, LuPencil } from "react-icons/lu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useFlow } from "@/views/hub/hooks";
import { DataFormat } from "@/bindings/DataFormat";

export type SourceNode = Node<SourceNodeData, "SourceNode">;

const SourceNode = (props: NodeProps<SourceNode>) => {
  const { flow } = useFlow();
  const [showForm, setShowForm] = useState(false);

  const [preview, deleteNode] = useFlowStore(
    useShallow((state) => [state.previews[props.id], state.deleteNode]),
  );

  const onDelete = useCallback(async () => {
    if (flow) {
      try {
        await deleteNodeData(flow, props.id);
      } catch (e) {
        console.error(e);
      }
      deleteNode(props.id);
    }
  }, [flow, props.id]);

  return (
    <BaseNode>
      <Header
        nodeId={props.id}
        title={props.data.label}
        type="SourceNode"
        onEdit={() => setShowForm(true)}
        onDelete={onDelete}
        showTable={true}
      />
      <LabeledHandle title="out" type="source" position={Position.Right} />
      <BaseNodeContent>
        {props.data.source ? (
          <div className="text-xs grid gap-2 grid-cols-[min-content_1fr] gap-y-0">
            <div className="text-muted-foreground">Source</div>
            <div className="font-mono">
              {" "}
              {middleTruncate(props.data.source, 30)}
            </div>
            <div className="text-muted-foreground">Type</div>
            <div className="font-mono">{props.data.format.type}</div>
            {preview && (
              <>
                <div className="text-muted-foreground">Records</div>
                <div className="font-mono">{preview.output?.total}</div>
              </>
            )}
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
      <Footer nodeId={props.id} />

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="">
          <DialogHeader>
            <DialogTitle>Source settings</DialogTitle>
          </DialogHeader>
          <div className="w-full pt-5 h-full overflow-auto">
            <SourceForm
              id={props.id}
              data={props.data}
              onSubmit={() => setShowForm(false)}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </BaseNode>
  );
};

export default memo(SourceNode);

const SourceForm = ({
  id,
  onSubmit,
  onCancel,
  data,
  ...props
}: {
  id: string;
  onSubmit: (values: SourceNodeData) => void;
  onCancel: () => void;
  data?: SourceNodeData;
} & React.ComponentProps<"form">) => {
  const store = useFlowStore();
  const form = useForm({
    defaultValues:
      data ||
      ({
        label: "",
        format: { type: "Csv", comma_delimiter: true },
        source: "",
        cache: false,
      } as SourceNodeData),
    onSubmit: async (value) => {
      store.setNodes(
        store.nodes.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...value.value,
              },
            };
          } else {
            return n;
          }
        }),
      );
      await store.save();
      onSubmit(value.value);
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
          <form.Field
            name="source"
            children={(field) => (
              <Field>
                <FieldLabel>Source</FieldLabel>
                <div className="flex items-center gap-2">
                  <InputGroup>
                    <InputGroupAddon align="inline-end">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          const file = await pickFile();
                          if (file) {
                            field.handleChange(file);
                          }
                        }}
                      >
                        <LuFolderSearch />
                      </Button>
                    </InputGroupAddon>
                    <InputGroupInput
                      className="font-mono"
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
                </div>
              </Field>
            )}
          />
          <form.Subscribe selector={(state) => state.values.source}>
            {(source) => {
              if (isHttpUrl(source)) {
                return (
                  <>
                    <form.Field
                      name="cache"
                      children={(field) => (
                        <Field>
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id="cache"
                              checked={field.state.value}
                              onCheckedChange={(e) =>
                                field.handleChange(
                                  e === "indeterminate" ? true : !!e,
                                )
                              }
                              onBlur={field.handleBlur}
                            />
                            <div className="grid gap-2">
                              <Label htmlFor="cache">Cache</Label>
                              <p className="text-muted-foreground text-sm">
                                Cache the dataset in local file system
                              </p>
                            </div>
                          </div>
                        </Field>
                      )}
                    />
                    <form.Field
                      name="headers"
                      children={(field) => (
                        <Field>
                          <FieldLabel>Headers</FieldLabel>
                          <div className="flex flex-col gap-2">
                            {field.state.value?.map(([key, value], i) => (
                              <form.Field
                                key={i}
                                name={`headers[${i}]`}
                                children={(subField) => (
                                  <div className="grid grid-cols-[1fr_1fr_min-content] w-full gap-2 gap-y-0 items-center">
                                    <Input
                                      type="text"
                                      placeholder="Name"
                                      className="font-mono"
                                      value={key}
                                      onChange={(e) =>
                                        subField.handleChange([
                                          e.currentTarget.value,
                                          value,
                                        ])
                                      }
                                      onBlur={subField.handleBlur}
                                      autoComplete="off"
                                      autoCorrect="off"
                                      autoCapitalize="off"
                                    />

                                    <Input
                                      type="text"
                                      placeholder="Value"
                                      className="font-mono"
                                      value={value}
                                      onChange={(e) =>
                                        subField.handleChange([
                                          key,
                                          e.currentTarget.value,
                                        ])
                                      }
                                      onBlur={subField.handleBlur}
                                      autoComplete="off"
                                      autoCorrect="off"
                                      autoCapitalize="off"
                                    />

                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      type="button"
                                      onClick={() => {
                                        field.removeValue(i);
                                      }}
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
                                onClick={() => field.pushValue(["", ""])}
                              >
                                + add header
                              </Button>
                            </div>
                          </div>
                        </Field>
                      )}
                    />
                  </>
                );
              } else {
                return null;
              }
            }}
          </form.Subscribe>

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
        </FieldGroup>
        <div className="mt-2">
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            children={([canSubmit, isSubmitting]) => (
              <div className="flex flex-row gap-2 justify-end">
                <Button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onCancel}
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
