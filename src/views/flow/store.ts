import { create } from "zustand";
import { Node } from "@/bindings/Node";
import { Edge } from "@/bindings/Edge";
import { NodeExecutionMessage } from "@/bindings/NodeExecutionMessage";
import { DEFAULT_RUN_OPTIONS } from "./constants";
import { v4 as uuidv4 } from "uuid";
import { NodeExecutionPreview } from "@/bindings/NodeExecutionPreview";
import { executeNode, loadFlow, saveFlow } from "@/commands";

export type FlowState = {
  id: string | undefined;
  name: string | undefined;
  created_at: string | undefined;
  updated_at: string | undefined;
  nodes: Node[];
  edges: Edge[];
  previews: Record<string, { status: string } & Partial<NodeExecutionPreview>>;
  executions: Record<string, NodeExecutionMessage[]>;
};

type FlowActions = {
  load: (id: string) => Promise<void>;
  clear: () => void;
  setNodes: (nodes: Node[]) => void;
  addNode: (node: Node) => void;
  getNode: (id: string) => Node | undefined;
  deleteNode: (id: string) => void;
  setEdges: (edges: Edge[]) => void;
  save: () => Promise<void>;
  run: (nodeId: string) => Promise<void>;
  addNodeExecutionMessage: (msg: NodeExecutionMessage) => void;
};

const migrations: ((nodes: Node[], edges: Edge[]) => void)[] = [
  (nodes, edges) => {
    edges.forEach((edge) => {
      if (!edge.type) {
        edge.type = "CustomEdge";
      }
    });
  },
];

const useFlowStore = create<FlowState & FlowActions>((set, get) => {
  let saveTimeout: NodeJS.Timeout | null = null;
  const debouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      get().save();
    }, 300);
  };

  return {
    id: undefined,
    name: undefined,
    created_at: undefined,
    updated_at: undefined,
    executions: {},
    previews: {},
    nodes: [],
    edges: [],
    clear: () =>
      set({
        id: undefined,
        name: undefined,
        previews: {},
        executions: {},
        nodes: [],
        edges: [],
      }),
    load: async (id: string) => {
      set({
        previews: {},
        id,
        created_at: undefined,
        updated_at: undefined,
        name: undefined,
        nodes: [],
        executions: {},
        edges: [],
      });
      const flow = await loadFlow(id);
      set({
        name: flow.name,
        created_at: flow.created_at,
        updated_at: flow.updated_at,
        nodes: flow.nodes,
        edges: flow.edges,
      });
    },
    addNodeExecutionMessage(msg: NodeExecutionMessage) {
      set((state) => {
        const executions = state.executions;
        let messages = executions[msg.node_id] || [];
        if (
          messages.length > 0 &&
          messages[messages.length - 1].run_id !== msg.run_id
        ) {
          messages = [];
        }

        // replace last message for consecutive progress messages
        if (
          msg.type === "Progress" &&
          messages.length > 0 &&
          messages[messages.length - 1].type === "Progress"
        ) {
          messages.pop();
        }

        executions[msg.node_id] = [...messages, msg];

        let previews = state.previews;
        if (msg.type === "Success" && msg.preview) {
          previews[msg.node_id] = {
            ...previews[msg.node_id],
            status: "success",
            ...msg.preview,
          };
        } else {
          delete previews[msg.node_id];
        }

        return { ...state, executions, previews };
      });
    },
    save: async () => {
      const { id, name, nodes, edges } = get();
      if (!id || !name) {
        return;
      }
      migrations.forEach((migration) => migration(nodes, edges));
      saveFlow({
        id,
        name,
        nodes,
        edges,
        created_at: new Date(get().created_at || "").toISOString(),
        updated_at: new Date(get().updated_at || "").toISOString(),
      });
    },
    run: async (nodeId: string) => {
      set((state) => ({
        ...state,
        previews: {
          ...state.previews,
          [nodeId]: { ...state.previews[nodeId], status: "loading" },
        },
      }));
      try {
        const res = await executeNode(get().id!, nodeId, {
          ...DEFAULT_RUN_OPTIONS,
          run_id: uuidv4(),
        });
        const previews: Record<
          string,
          { status: string } & Partial<NodeExecutionPreview>
        > = {};
        for (const [key, value] of Object.entries(res)) {
          previews[key] = { ...value, status: "success" };
        }
        set((state) => ({
          ...state,
          previews: {
            ...state.previews,
            ...previews,
          },
        }));
      } catch (e) {
        set((state) => ({
          ...state,
          previews: {
            ...state.previews,
            [nodeId]: { ...state.previews[nodeId], status: "error" },
          },
        }));
        throw e;
      }
    },

    getNode: (id: string) => get().nodes.find((n) => n.id === id),
    addNode: (node: Node) =>
      set((state) => {
        const newState = { ...state, nodes: [...state.nodes, node] };
        // todo fix hack
        debouncedSave();
        return newState;
      }),
    deleteNode: (id: string) =>
      set((state) => {
        const newState = {
          ...state,
          nodes: state.nodes.filter((n) => n.id !== id),
          edges: state.edges.filter((e) => e.source !== id),
        };
        // todo fix hack
        debouncedSave();
        return newState;
      }),
    setNodes: (nodes: Node[]) =>
      set((state) => {
        const newState = { nodes };
        // todo fix hack
        debouncedSave();
        return newState;
      }),

    setEdges: (edges: Edge[]) =>
      set((state) => {
        const newState = { edges };
        // todo fix hack
        debouncedSave();
        return newState;
      }),
  };
});

export default useFlowStore;
