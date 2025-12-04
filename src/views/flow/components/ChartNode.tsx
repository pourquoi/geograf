import { BaseNode, BaseNodeContent } from "@/components/base-node";
import { Node, NodeProps, Position } from "@xyflow/react";
import React, { useMemo, useState } from "react";
import useFlowStore from "../store";
import Header from "./Header";
import { LabeledHandle } from "@/components/labeled-handle";
import { useForm } from "@tanstack/react-form";
import { cn } from "@/lib/utils";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LuPencil } from "react-icons/lu";
import { useNodeData } from "../hooks";
import { NodeReaderOptions } from "@/bindings/NodeReaderOptions";
import { DEFAULT_READ_OPTIONS } from "../constants";
import { useShallow } from "zustand/react/shallow";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  PieChart,
  AreaChart,
  LineChart,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  Line,
  Area,
  Pie,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
  SelectTrigger,
} from "@/components/ui/select";
import { ChartNodeData } from "@/bindings/ChartNodeData";

const xAxisName: { [key: string]: string } = {
  bar: "X Column",
  line: "X Column",
  area: "X Column",
  pie: "Data Column",
};

const yAxisName: { [key: string]: string } = {
  bar: "Y Column",
  line: "Y Column",
  area: "Y Column",
  pie: "Name Column",
};

export type ChartNode = Node<ChartNodeData, "ChartNode">;

const BarChartNode = (props: NodeProps<ChartNode>) => {
  const store = useFlowStore();

  const [showForm, setShowForm] = useState(false);
  const [showChart, setShowChart] = useState(false);

  const sourceId = useFlowStore(
    useShallow((state) => {
      return state.edges.find((e) => e.target === props.id)?.source;
    }),
  );

  const onDelete = () => {
    store.deleteNode(props.id);
  };

  const isInputConnectable = !store.edges.find((e) => e.target === props.id);

  const run = async (debug?: boolean) => {
    setShowChart(true);
  };

  return (
    <BaseNode className="min-w-[300px]">
      <Header
        nodeId={props.id}
        title={props.data.label}
        type="ChartNode"
        onEdit={() => setShowForm(true)}
        onDelete={() => onDelete()}
        showTable={false}
        onRun={run}
      />
      <LabeledHandle
        title="in"
        type="target"
        position={Position.Left}
        isConnectable={isInputConnectable}
      />
      <BaseNodeContent className="mb-2">
        {props.data.y_axis?.length > 0 &&
        props.data.y_axis.some((bar) => bar !== "") ? (
          <>
            <div className="text-xs items-center grid gap-2 grid-cols-[min-content_1fr] gap-y-0">
              <div className="text-muted-foreground">Type</div>
              <div className="font-mono">{props.data.chart_type}</div>
              <div className="text-muted-foreground whitespace-pre">
                {xAxisName[props.data.chart_type]}
              </div>
              <div className="font-mono">{props.data.x_axis}</div>
              {props.data.y_axis?.map((bar, i) => (
                <React.Fragment key={i}>
                  <div className="text-muted-foreground whitespace-pre">
                    {yAxisName[props.data.chart_type]}
                  </div>
                  <div className="font-mono">{bar}</div>
                </React.Fragment>
              ))}
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
      <Dialog open={showForm} onOpenChange={setShowForm} modal={false}>
        <DialogContent className="sm:w-auto sm:max-w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>Chart settings</DialogTitle>
          </DialogHeader>
          <div className="w-full pt-5 h-full overflow-auto">
            <BarChartNodeForm
              className="flex-1 sm:w-[400px] sm:max-w-[400px]"
              id={props.id}
              sourceId={sourceId}
              data={props.data}
              onSave={(values, close) => setShowForm(!close)}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {sourceId && (
        <Dialog open={showChart} onOpenChange={setShowChart} modal={false}>
          <DialogContent className="sm:w-auto sm:max-w-[calc(100%-2rem)] overflow-y-auto overflow-x-visible flex-1 flex flex-col gap-2">
            <DialogHeader>
              <DialogTitle>{props.data.label || "Chart"}</DialogTitle>
            </DialogHeader>
            <Chart config={props.data} open={showChart} nodeId={props.id} />
          </DialogContent>
        </Dialog>
      )}
    </BaseNode>
  );
};

export default BarChartNode;

const BarChartNodeForm = ({
  id,
  sourceId,
  onSave,
  onCancel,
  data,
  ...props
}: {
  id: string;
  sourceId?: string;
  onSave: (values: ChartNodeData, close?: boolean) => void;
  onCancel: () => void;
  data?: ChartNodeData;
} & React.ComponentProps<"form">) => {
  const [showLogs, setShowLogs] = useState(false);

  const store = useFlowStore();
  const form = useForm({
    defaultValues: (data || {
      label: "",
      chart_type: "bar",
      x_axis: "",
      y_axis: [],
      limit: 10000,
      options: null,
    }) as Omit<ChartNodeData, "options">,
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
      onSave(value, !meta?.run || !sourceId);
      // @ts-ignore
      if (meta?.run && sourceId) {
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
            name="chart_type"
            children={(field) => (
              <Field>
                <FieldLabel>Chart type</FieldLabel>
                <Select
                  name={field.name}
                  value={field.state.value}
                  onValueChange={(e) => field.handleChange(e)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Chart Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="line">Line</SelectItem>
                    <SelectItem value="area">Area</SelectItem>
                    <SelectItem value="pie">Pie</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
          />

          <form.Field
            name="limit"
            children={(field) => (
              <Field>
                <FieldLabel>Limit</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  value={field.state.value || ""}
                  type="number"
                  min={0}
                  step={1}
                  onChange={(e) =>
                    field.handleChange(
                      e.currentTarget.value
                        ? Number(e.currentTarget.value)
                        : null,
                    )
                  }
                  onBlur={field.handleBlur}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                />
              </Field>
            )}
          />

          <form.Subscribe
            selector={(state) => state.values.chart_type}
            children={(chart_type) => {
              return (
                <>
                  <form.Field
                    name="x_axis"
                    children={(field) => (
                      <Field>
                        <FieldLabel>
                          {xAxisName[chart_type] || "X axis"}
                        </FieldLabel>
                        <Input
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
                      </Field>
                    )}
                  />
                  <form.Field
                    name="y_axis"
                    children={(field) => (
                      <Field>
                        <FieldLabel>
                          {yAxisName[chart_type] || "Y axis"}
                        </FieldLabel>
                        <div className="flex flex-col gap-2">
                          {field.state.value.map((y_axis, i) => {
                            if (chart_type === "pie" && i > 0) {
                              return null;
                            }
                            return (
                              <form.Field
                                key={i}
                                name={`y_axis[${i}]`}
                                children={(subField) => (
                                  <div
                                    key={i}
                                    className="grid grid-cols-[1fr_min-content] w-full flex-row gap-2 gap-y-0 items-center"
                                  >
                                    <Input
                                      type="text"
                                      className="font-mono"
                                      value={y_axis}
                                      onChange={(e) =>
                                        subField.handleChange(
                                          e.currentTarget.value,
                                        )
                                      }
                                      onBlur={field.handleBlur}
                                      autoComplete="off"
                                      autoCorrect="off"
                                      autoCapitalize="off"
                                    />
                                    {chart_type !== "pie" && (
                                      <>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          type="button"
                                          onClick={() => field.removeValue(i)}
                                        >
                                          -
                                        </Button>
                                        {subField.state.meta.errors.length >
                                          0 && (
                                          <div className="p-2 text-red-500 text-xs font-mono whitespace-pre overflow-x-auto">
                                            {subField.state.meta.errors.join(
                                              ", ",
                                            )}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              />
                            );
                          })}
                          {(chart_type !== "pie" ||
                            field.state.value.length < 1) && (
                            <div className="flex justify-start">
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={() => field.pushValue("")}
                              >
                                + add {yAxisName[chart_type]}
                              </Button>
                            </div>
                          )}
                        </div>
                      </Field>
                    )}
                  />
                </>
              );
            }}
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
                  onClick={() => form.handleSubmit({ run: false })}
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

let chartConfig: {
  [key: string]: { color?: string; label?: React.ReactNode };
} = {} satisfies ChartConfig;
for (let i = 0; i < 5; i++) {
  chartConfig[`chart_${i + 1}`] = {
    color: `var(--chart-${i + 1})`,
  };
}

const Chart = ({
  config,
  open,
  nodeId,
}: {
  config: ChartNodeData;
  open: boolean;
  nodeId: string;
}) => {
  const [options] = useState<NodeReaderOptions>({
    ...DEFAULT_READ_OPTIONS,
    page_size: config.limit || 100000,
  });

  const { data, isSuccess, isLoading } = useNodeData(nodeId, options, open);

  config.y_axis.forEach((c, i) => {
    chartConfig[`{c}`] = {
      color: `var(--color-${1 + (i % 5)})`,
      label: c,
    };
  });

  const chartData = useMemo(() => {
    if (config.chart_type === "pie") {
      return (data?.data || []).map((d: any, i: number) => {
        d["fill"] = `var(--chart-${1 + (i % 5)})`;
        return d;
      });
    } else {
      return data?.data || [];
    }
  }, [data]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isSuccess || !data?.data) {
    return <div>Error</div>;
  }

  return (
    <>
      {config.chart_type === "bar" && (
        <ChartContainer
          config={chartConfig}
          className="h-[400px] min-h-[400px] w-full"
        >
          <BarChart data={data?.data || []}>
            <CartesianGrid vertical={false} />
            {config.x_axis && (
              <XAxis
                dataKey={config.x_axis}
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value}
              />
            )}
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {config.y_axis?.map((bar, i) => (
              <Bar
                key={i}
                dataKey={bar}
                fill={`var(--color-chart_${1 + (i % 5)})`}
                radius={4}
              />
            ))}
          </BarChart>
        </ChartContainer>
      )}

      {config.chart_type === "line" && (
        <ChartContainer
          config={chartConfig}
          className="h-[400px] min-h-[400px] w-full"
        >
          <LineChart data={data?.data || []}>
            <CartesianGrid vertical={false} />
            {config.x_axis && (
              <XAxis
                dataKey={config.x_axis}
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value}
              />
            )}
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {config.y_axis?.map((bar, i) => (
              <Line
                key={i}
                dataKey={bar}
                stroke={`var(--color-chart_${1 + (i % 5)})`}
                dot={false}
                strokeWidth={2}
              />
            ))}
          </LineChart>
        </ChartContainer>
      )}

      {config.chart_type === "area" && (
        <ChartContainer
          config={chartConfig}
          className="h-[400px] min-h-[400px] w-full"
        >
          <AreaChart data={data?.data || []}>
            <CartesianGrid vertical={false} />
            {config.x_axis && (
              <XAxis
                dataKey={config.x_axis}
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value}
              />
            )}
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {config.y_axis?.map((bar, i) => (
              <Area
                key={i}
                dataKey={bar}
                fill={`var(--color-chart_${1 + (i % 5)})`}
                stroke={`var(--color-chart_${1 + (i % 5)})`}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      )}

      {config.chart_type === "pie" && (
        <ChartContainer
          config={chartConfig}
          className="h-[400px] min-h-[400px] w-full"
        >
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent />} />
            {config.y_axis.length > 0 && (
              <Pie
                data={chartData}
                dataKey={config.x_axis}
                nameKey={config.y_axis[0]}
              />
            )}
          </PieChart>
        </ChartContainer>
      )}
    </>
  );
};
