import { NodeExecutorOptions } from "@/bindings/NodeExecutorOptions";
import { NodeReaderOptions } from "@/bindings/NodeReaderOptions";

export const DEBUG = false;
export const SYNTAX_CHECK_DELAY = 1000;
export const DEFAULT_RUN_OPTIONS: Omit<NodeExecutorOptions, "run_id"> = {
  diagnostic: false,
  page: 1,
  page_size: 100,
};
export const DEFAULT_READ_OPTIONS: NodeReaderOptions = {
  output: "",
  page: 1,
  page_size: 100,
  select: [""],
  append: true,
  filter: null,
  sort: null,
};
