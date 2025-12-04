import { invoke } from "@tauri-apps/api/core";
import { NodeExecutorOptions } from "@/bindings/NodeExecutorOptions";
import { NodeExecutionPreview } from "@/bindings/NodeExecutionPreview";
import { NodeReaderOptions } from "@/bindings/NodeReaderOptions";
import { NodeReadOutput } from "@/bindings/NodeReadOutput";
import { Flow } from "./bindings/Flow";
import { Demo } from "./bindings/Demo";

export async function pickFile() {
  return await invoke<string>("pick_file");
}

export async function saveFile() {
  return await invoke<string>("save_file");
}

export async function getFlows() {
  const res = await invoke<Flow[]>("list_flows");
  console.log(res);
  return res;
}

export async function loadFlow(id: string) {
  const res = await invoke<Flow>("load_flow", { id });
  console.log(res);
  return res;
}

export async function saveFlow(flow: Flow) {
  return await invoke<void>("save_flow", { flow });
}

export async function deleteFlow(id: string) {
  return await invoke<void>("delete_flow", { id });
}

export async function exportFlow(id: string) {
  return await invoke<void>("export_flow", { id });
}

export async function duplicateFlow(id: string) {
  return await invoke<string>("duplicate_flow", { id });
}

export async function importFlow() {
  return await invoke<String>("import_flow");
}

export async function listDemos() {
  return await invoke<Demo[]>("list_demos");
}

export async function loadDemo(demoName: string, flowName: string) {
  return await invoke<string>("load_demo", { demoName, flowName });
}

export async function executeNode(
  id: string,
  nodeId: string,
  options?: NodeExecutorOptions,
) {
  return await invoke<Record<string, NodeExecutionPreview>>("execute_node", {
    id,
    nodeId,
    options,
  });
}

export async function readData(
  id: string,
  nodeId: string,
  options?: NodeReaderOptions,
) {
  console.log("read data", nodeId);
  const res = await invoke<NodeReadOutput>("read_data", {
    id,
    nodeId,
    options,
  });
  console.log(res);
  return res;
}

export async function checkSyntax(expr: string) {
  try {
    await invoke<any>("check_syntax", { expr });
  } catch (e: any) {
    return e as string;
  }
}

export async function deleteNodeData(id: string, nodeId: string) {
  await invoke<any>("delete_node_data", { id, nodeId });
}
