import { invoke } from "@tauri-apps/api/core";
import { NodeExecutorOptions } from "@/bindings/NodeExecutorOptions";
import { NodeExecutionPreview } from "@/bindings/NodeExecutionPreview";
import { NodeReaderOptions } from "@/bindings/NodeReaderOptions";
import { NodeReadOutput } from "@/bindings/NodeReadOutput";
import { Flow } from "./bindings/Flow";
import { Demo } from "./bindings/Demo";
import { DataFormat } from "./bindings/DataFormat";

export async function pickFile() {
  return await invoke<string>("pick_file");
}

export async function saveFile() {
  return await invoke<string>("save_file");
}

export async function hasNodeFile(flowId: string, nodeId: string) {
  return await invoke<[string, DataFormat] | null>("has_node_file", {
    flowId,
    nodeId,
  });
}

export async function openNodeFile(flowId: string, nodeId: string) {
  return await invoke<string>("open_node_file", { flowId, nodeId });
}

export async function uploadFile(name: string, format: DataFormat, file: File) {
  let path = await invoke<string>("upload_start", { name, format });

  const CHUNK_SIZE = 1024 * 1024;
  const total = file.size;
  let offset = 0;

  while (offset < total) {
    const end = Math.min(offset + CHUNK_SIZE, total);

    const slice = file.slice(offset, end);
    const buf = new Uint8Array(await slice.arrayBuffer());

    await invoke("upload_chunk", {
      name,
      data: [...buf],
    });

    offset = end;
  }

  await invoke<string>("upload_end", { name });

  return path;
}

export async function getFlows() {
  return await invoke<Flow[]>("list_flows");
}

export async function loadFlow(id: string) {
  return await invoke<Flow>("load_flow", { id });
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
  return await invoke<NodeReadOutput>("read_data", {
    id,
    nodeId,
    options,
  });
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
