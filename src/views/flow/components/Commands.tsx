import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandDialog,
} from "@/components/ui/command";
import { Node } from "@/bindings/Node";

import { v4 as uuidv4 } from "uuid";
import useFlowStore from "../store";
import React, { ComponentProps, useCallback, useEffect, useState } from "react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Search } from "lucide-react";
import { useReactFlow, useStore as useReactFlowStore } from "@xyflow/react";
import { NodeType } from "@/bindings/NodeType";
import { nodeIcons } from "../Flow";

const DEFAULT_NODES_DATA: { [key in NodeType]: any } = {
  SourceNode: {
    label: "Source",
    format: { type: "Csv", comma_delimiter: true },
    cache: true,
  },
  JoinNode: { label: "Join", how: "inner" },
  ConcatNode: { label: "Concat", horizontal: false },
  SinkNode: {
    label: "Sink",
    format: { type: "Parquet", comma_delimiter: true },
  },
  SelectNode: { label: "Select", exprs: [""], with_columns: false },
  FilterNode: { label: "Filter", expr: "" },
  GroupByNode: { label: "GroupBy", exprs: [], aggrs: [] },
  SortNode: { label: "Sort", by: [{ name: "", asc: true }] },
  ChartNode: { label: "Chart", x_axis: "", y_axis: [""] },
  DescribeNode: { label: "Describe" },
  Unknown: {},
};

const Commands = ({ ...props }: ComponentProps<"div">) => {
  const { setNodes, nodes } = useFlowStore();
  const [open, setOpen] = useState(false);

  const resetSelectedElements = useReactFlowStore(
    (state) => state.resetSelectedElements,
  );
  const addSelectedNodes = useReactFlowStore((state) => state.addSelectedNodes);

  const { screenToFlowPosition, fitBounds } = useReactFlow();

  const computeNewNodePosition = useCallback(() => {
    const screenCenter = {
      x:
        window.innerWidth / 2 + ((Math.random() - 0.5) * window.innerWidth) / 5,
      y:
        window.innerHeight / 2 +
        ((Math.random() - 0.5) * window.innerHeight) / 5,
    };

    const pos = screenToFlowPosition(screenCenter);
    return pos;
  }, []);

  const addNode = (type: NodeType) => {
    const id = uuidv4();
    const position = computeNewNodePosition();
    const newNode: Node = {
      id,
      data: DEFAULT_NODES_DATA[type],
      type,
      position,
    };
    setNodes(nodes.concat(newNode));
    setOpen(false);
    setTimeout(() => {
      resetSelectedElements();
      addSelectedNodes([newNode.id]);
    });
    fitBounds(
      { x: position.x, y: position.y, width: 300, height: 200 },
      { duration: 300, padding: 0.2 },
    );
  };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "n" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <div {...props}>
      <InputGroup
        className="!bg-slate-950 pointer-events-auto"
        onClick={() => setOpen((open) => !open)}
      >
        <InputGroupInput placeholder="Add a node..." />
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupAddon align="inline-end">
          <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none">
            <span className="text-xs">⌘</span>N
          </kbd>
        </InputGroupAddon>
      </InputGroup>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Add a node"
        description="Search for a node to add..."
      >
        <Command>
          <CommandInput placeholder="Add a node..." />
          <CommandList onSelect={() => setOpen(false)}>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Load">
              <CommandItem onSelect={() => addNode("SourceNode")}>
                <>
                  {React.createElement(nodeIcons.SourceNode, {
                    className: "w-5 h-5",
                  })}
                  Source
                </>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Save">
              <CommandItem onSelect={() => addNode("SinkNode")}>
                <>
                  {React.createElement(nodeIcons.SinkNode, {
                    className: "w-5 h-5",
                  })}
                  Sink
                </>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Transform">
              <CommandItem onSelect={() => addNode("SelectNode")}>
                <>
                  {React.createElement(nodeIcons.SelectNode, {
                    className: "w-5 h-5",
                  })}
                  Select
                </>
              </CommandItem>
              <CommandItem onSelect={() => addNode("FilterNode")}>
                <>
                  {React.createElement(nodeIcons.FilterNode, {
                    className: "w-5 h-5",
                  })}
                  Filter
                </>
              </CommandItem>
              <CommandItem onSelect={() => addNode("GroupByNode")}>
                <>
                  {React.createElement(nodeIcons.GroupByNode, {
                    className: "w-5 h-5",
                  })}
                  Group by
                </>
              </CommandItem>
              <CommandItem onSelect={() => addNode("SortNode")}>
                <>
                  {React.createElement(nodeIcons.SortNode, {
                    className: "w-5 h-5",
                  })}
                  Sort
                </>
              </CommandItem>
              <CommandItem onSelect={() => addNode("JoinNode")}>
                <>
                  {React.createElement(nodeIcons.JoinNode, {
                    className: "w-5 h-5",
                  })}
                  Join
                </>
              </CommandItem>
              <CommandItem onSelect={() => addNode("ConcatNode")}>
                <>
                  {React.createElement(nodeIcons.ConcatNode, {
                    className: "w-5 h-5",
                  })}
                  Concat
                </>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Widgets">
              <CommandItem onSelect={() => addNode("DescribeNode")}>
                <>
                  {React.createElement(nodeIcons.DescribeNode, {
                    className: "w-5 h-5",
                  })}
                  Describe
                </>
              </CommandItem>
              <CommandItem onSelect={() => addNode("ChartNode")}>
                <>
                  {React.createElement(nodeIcons.ChartNode, {
                    className: "w-5 h-5",
                  })}
                  Chart
                </>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </div>
  );
};

export default Commands;
