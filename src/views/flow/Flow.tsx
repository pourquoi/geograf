import { useCallback, useEffect } from "react";
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Background,
  MiniMap,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import SourceNode from "./components/SourceNode.tsx";
import SelectNode from "./components/SelectNode.tsx";
import GroupByNode from "./components/GroupByNode.tsx";
import SortNode from "./components/SortNode.tsx";
import JoinNode from "./components/JoinNode.tsx";
import SinkNode from "./components/SinkNode.tsx";
import useFlowStore from "./store";
import { Button } from "@/components/ui/button.tsx";
import FilterNode from "./components/FilterNode.tsx";
import {
  LuArrowLeftRight,
  LuChartBar,
  LuCirclePlus,
  LuDatabase,
  LuDownload,
  LuFilter,
  LuGroup,
  LuInfo,
  LuMerge,
  LuSearch,
} from "react-icons/lu";
import { LucideSortAsc } from "lucide-react";
import Commands from "./components/Commands.tsx";
import { CustomEdge } from "@/components/base-edge.tsx";
import { useFlow } from "../hub/hooks.ts";
import { useMessageListener } from "./hooks.ts";
import ChartNode from "./components/ChartNode.tsx";
import ConcatNode from "./components/ConcatNode.tsx";
import DescribeNode from "./components/DescribeNode.tsx";

const nodeTypes = {
  SourceNode,
  SelectNode,
  FilterNode,
  GroupByNode,
  SortNode,
  JoinNode,
  SinkNode,
  ChartNode,
  ConcatNode,
  DescribeNode,
};

const edgeTypes = {
  CustomEdge: CustomEdge,
};

export const nodeLabels: { [key: string]: string } = {
  SourceNode: "Source",
  SelectNode: "Select",
  FilterNode: "Filter",
  GroupByNode: "GroupBy",
  SortNode: "Sort",
  JoinNode: "Join",
  SinkNode: "Sink",
  ChartNode: "Chart",
  ConcatNode: "Concat",
  DescribeNode: "Describe",
};

export const nodeIcons: {
  [key: string]: React.FC<React.SVGProps<SVGSVGElement>>;
} = {
  SourceNode: LuDatabase,
  SelectNode: LuFilter,
  FilterNode: LuSearch,
  GroupByNode: LuGroup,
  SortNode: LucideSortAsc,
  JoinNode: LuMerge,
  SinkNode: LuDownload,
  ChartNode: LuChartBar,
  ConcatNode: LuCirclePlus,
  DescribeNode: LuInfo,
};

export default function Flow({ onSwitch }: { onSwitch?: () => void }) {
  const { flow: flowId } = useFlow();
  const { name, load, clear, nodes, edges, setNodes, setEdges } =
    useFlowStore();
  useMessageListener();

  useEffect(() => {
    if (flowId) {
      load(flowId);
    } else {
      clear();
    }
  }, [flowId]);

  const onNodesChange = useCallback(
    // @ts-ignore
    (changes) => {
      // @ts-ignore
      setNodes(applyNodeChanges(changes, nodes));
    },
    [setNodes, nodes],
  );
  const onEdgesChange = useCallback(
    // @ts-ignore
    (changes) => {
      // @ts-ignore
      setEdges(applyEdgeChanges(changes, edges));
    },
    [setEdges, edges],
  );
  const onConnect = useCallback(
    // @ts-ignore
    (params) => setEdges(addEdge({ ...params, type: "CustomEdge" }, edges)),
    [setEdges, edges],
  );

  return (
    <>
      <div className="h-dvh w-screen z-100">
        <ReactFlow
          nodes={nodes as any}
          edges={edges as any}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          minZoom={0.01}
          fitView
        >
          <div className="fixed z-200 pt-0 top-0 left-0 w-screen h-dvh pointer-events-none">
            <div className="grid grid-cols-[min-content_1fr] md:grid-cols-3 items-center gap-2 p-2 justify-between relative ">
              <div className="flex w-auto items-center gap-2">
                <Button
                  className="pointer-events-auto"
                  variant="ghost"
                  size="icon"
                  onClick={() => onSwitch?.()}
                >
                  <LuArrowLeftRight className="" />
                </Button>
                <div className="text-lg mr-8"> {name}</div>
              </div>
              <Commands className="mx-auto min-w-[200px]" />
              <div className="hidden md:invisible" />
            </div>
          </div>
          <Background color="var(--foreground)" />
          <MiniMap
            maskColor="#00010e"
            bgColor="#5c6881"
            nodeColor="#00010e"
            pannable={true}
            position="bottom-left"
            zoomable={true}
          />
        </ReactFlow>
      </div>
    </>
  );
}
