import { useContext } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { flowContext } from "../../providers";
import { useForm } from "@tanstack/react-form";
import { Flow } from "@/bindings/Flow";
import {
  deleteFlow,
  duplicateFlow,
  getFlows,
  loadDemo,
  loadFlow,
  saveFlow,
} from "@/commands";
import { v4 as uuidv4 } from "uuid";
import useFlowStore from "../flow/store";
import { useShallow } from "zustand/react/shallow";

const FLOWS_KEY = "flows";

export function useFlow() {
  const { flow, setFlow } = useContext(flowContext);

  const switchFlow = async (newFlow: string | null) => {
    setFlow(newFlow);
  };

  return { flow, switchFlow };
}

export function useFlows() {
  const query = useQuery({
    queryKey: [FLOWS_KEY],
    queryFn: getFlows,
  });
  return query;
}

export function useDuplicateFlow(id: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      console.log("duplicate", id);
      const newId = await duplicateFlow(id);
      console.log(newId);
      const flow = await loadFlow(newId);
      console.log(flow);
      return flow;
    },
    onSuccess: (newFlow) => {
      queryClient.setQueryData([FLOWS_KEY], (old: Flow[] | null) => {
        if (!old) {
          return [newFlow];
        }
        return [...old, newFlow];
      });
    },
  });

  return { ...mutation };
}

export function useFlowForm(flow?: Flow) {
  const queryClient = useQueryClient();
  const [load, currentFlow] = useFlowStore(
    useShallow((state) => [state.load, state.id]),
  );

  const mutation = useMutation({
    mutationFn: async ({ flow, demo }: { flow: Flow; demo?: string }) => {
      let res: Flow;
      if (demo) {
        let id = await loadDemo(demo, flow.name);
        res = await loadFlow(id);
      } else {
        await saveFlow(flow);
        res = flow;
      }
      if (res.id === currentFlow) {
        load(currentFlow);
      }
      return res;
    },
  });

  const form = useForm({
    defaultValues: {
      id: flow?.id,
      name: flow?.name || "",
      nodes: flow?.nodes || [],
      edges: flow?.edges || [],
      demo: "",
    },
    onSubmit: async ({ value }) => {
      await mutation.mutateAsync({
        flow: {
          ...value,
          id: value.id || uuidv4(),
        },
        demo: value.demo,
      });
      queryClient.invalidateQueries({ queryKey: [FLOWS_KEY] });
    },
  });

  return { mutation, form };
}

export function useFlowDelete() {
  const queryClient = useQueryClient();
  const { flow, setFlow } = useContext(flowContext);
  const mutation = useMutation({
    mutationFn: async (id: string) => {
      if (id) {
        await deleteFlow(id);
        return id;
      }
    },
    onSuccess: (id) => {
      if (id && flow === id) {
        setFlow(null);
      }
      queryClient.invalidateQueries({ queryKey: [FLOWS_KEY] });
    },
  });

  return { ...mutation };
}
