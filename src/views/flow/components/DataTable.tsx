import React, { memo, useEffect, useMemo, useState } from "react";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  PaginationState,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LuExternalLink } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { DEFAULT_READ_OPTIONS, SYNTAX_CHECK_DELAY } from "../constants";
import { useForm } from "@tanstack/react-form";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { Label } from "@radix-ui/react-label";
import { AlertCircleIcon, LucideSortAsc, LucideSortDesc } from "lucide-react";
import { useFlow } from "@/views/hub/hooks";
import { checkSyntax } from "@/commands";
import { useNodeData } from "../hooks";
import { NodeReaderOptions } from "@/bindings/NodeReaderOptions";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  SelectItem,
  SelectTrigger,
  SelectValue,
  Select,
  SelectContent,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { nodeIcons } from "../Flow";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  CheatsheetContext,
  CheatsheetContextTrigger,
  CheatsheetProvider,
} from "./Cheatsheet";

export const DataValueDisplay = ({ value }: { value: any }) => {
  if (value === null) {
    return <span className="text-gray-500 italic">null</span>;
  }

  if (typeof value === "bigint") {
    return <span>{value.toString()}</span>;
  }

  if (typeof value === "boolean") {
    return <span>{value ? "true" : "false"}</span>;
  }

  if (Array.isArray(value)) {
    return (
      <span>
        {value.map((v, i) => (
          <React.Fragment key={i}>
            {i > 0 && ", "}
            <DataValueDisplay value={v} />
          </React.Fragment>
        ))}
      </span>
    );
  }

  if (typeof value === "object") {
    return (
      <span>
        {Object.entries(value).map(([k, v], i) => (
          <React.Fragment key={i}>
            {i > 0 && ", "}
            <span className="text-xs text-gray-500">{k}</span>:{" "}
            <DataValueDisplay value={v} />
          </React.Fragment>
        ))}
      </span>
    );
  }

  return <span>{value}</span>;
};

export const DataTableDialog = memo(({ nodeId }: { nodeId: string }) => {
  const { flow } = useFlow();
  const [open, setOpen] = useState(false);

  const [options, setOptions] =
    useState<NodeReaderOptions>(DEFAULT_READ_OPTIONS);

  const { data, isSuccess, isLoading, isFetching, error } = useNodeData(
    nodeId,
    options,
    open,
  );
  const defaultData = useMemo(() => [], []);

  const paginationItems = useMemo(() => {
    if (!isSuccess) {
      return [1];
    }
    const totalPages = Math.ceil(data?.total / options.page_size);
    const start = Math.max(options.page - 3, 1);
    const end = Math.min(totalPages, options.page + 3);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [options, data?.total]);

  const columnsDef: ColumnDef<any>[] = useMemo(() => {
    if (!isSuccess) {
      return [];
    }

    return (
      data.columns?.map((col) => {
        return {
          id: col.name,
          header: (state) => {
            const sort = state.table
              .getState()
              .sorting.find((s) => s.id === col.name);
            return (
              <div className="flex items-center justify-between gap-2">
                <div>
                  {col.name}
                  <br />
                  <span className="text-xs text-muted-foreground">
                    {col.dtype}
                  </span>
                </div>
                <div>
                  <Button
                    variant="ghost"
                    className={cn(sort ? "" : "opacity-30")}
                    size="icon"
                    onClick={() => {
                      if (sort?.desc) {
                        state.table.setSorting([]);
                      } else if (!sort) {
                        state.table.setSorting([{ id: col.name, desc: false }]);
                      } else {
                        state.table.setSorting([{ id: col.name, desc: true }]);
                      }
                    }}
                  >
                    {sort?.desc ? <LucideSortDesc /> : <LucideSortAsc />}
                  </Button>
                </div>
              </div>
            );
          },
          accessorKey: col.name,
          cell: (col) => <DataValueDisplay value={col.getValue()} />,
        };
      }) || []
    );
  }, [nodeId, isSuccess, data?.columns]);

  const table = useReactTable({
    data: data?.data || defaultData,
    columns: columnsDef,
    rowCount: data?.total || 0,
    getCoreRowModel: getCoreRowModel(),
    debugTable: true,
    state: {
      pagination: {
        pageIndex: options.page - 1,
        pageSize: options.page_size,
      },
      sorting: options.sort?.map((s) => ({ id: s[0], desc: !s[1] })) || [],
    },
    onSortingChange: (updater) => {
      let newSorting: SortingState;
      if (typeof updater !== "function") {
        newSorting = updater;
      } else {
        newSorting = updater(
          options.sort?.map((s) => ({ id: s[0], desc: !s[1] })) || [],
        );
      }
      setOptions({
        ...options,
        sort: newSorting.map((s) => [s.id, !s.desc]),
      });
    },
    onPaginationChange: (updater) => {
      let newPagination: PaginationState;
      if (typeof updater !== "function") {
        newPagination = updater;
      } else {
        newPagination = updater({
          pageIndex: options.page - 1,
          pageSize: options.page_size,
        });
      }
      setOptions({
        ...options,
        page: newPagination.pageIndex + 1,
        page_size: newPagination.pageSize,
      });
    },
    manualPagination: true,
    manualSorting: true,
  });

  const form = useForm({
    defaultValues: {
      filter: options.filter || "",
      select: options.select || [""],
    },
    onSubmit: async (values) => {
      setOptions({
        ...options,
        filter: values.value.filter || null,
        select: values.value.select?.filter((s) => s) || [],
      });
    },
  });

  useEffect(() => {
    if (!nodeId || !flow || !open) {
      setOptions(DEFAULT_READ_OPTIONS);
      form.reset();
    }
  }, [nodeId, open, options]);

  return (
    <>
      <Button variant="outline" size="icon" onClick={() => setOpen(true)}>
        <Tooltip>
          <TooltipTrigger>
            <LuExternalLink />
          </TooltipTrigger>
          <TooltipContent>
            <p>Explore dataset</p>
          </TooltipContent>
        </Tooltip>
      </Button>

      <CheatsheetProvider>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="!max-w-screen sm:max-w-[calc(100%-2rem)] h-screen">
            <div className="flex overflow-hidden flex-row gap-4">
              <div className="flex flex-1 flex-col overflow-auto">
                <DialogHeader>
                  <DialogTitle>Data explorer</DialogTitle>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      form.handleSubmit();
                    }}
                    className="grid grid-cols-[2fr_2fr_minmax(0,1fr)] gap-2 gap-x-4 mb-4  rounded-md p-2"
                    style={{
                      gridTemplateColumns:
                        "minmax(0, 1fr) minmax(0, 1fr) min-content",
                    }}
                  >
                    <form.Field
                      name="filter"
                      validators={{
                        onChangeAsync: async ({ value }) => {
                          if (value) return await checkSyntax(value);
                        },
                        onChangeAsyncDebounceMs: SYNTAX_CHECK_DELAY,
                      }}
                      children={(field) => (
                        <div className="flex flex-col">
                          <Label className="mb-2 inline-flex items-center gap-2">
                            {React.createElement(nodeIcons["FilterNode"])}
                            Filter
                          </Label>
                          <InputGroup>
                            <InputGroupAddon align="inline-end">
                              <CheatsheetContextTrigger />
                            </InputGroupAddon>
                            <InputGroupInput
                              id={field.name}
                              name={field.name}
                              className={cn(
                                "w-full font-mono",
                                field.state.meta.errors.length > 0 &&
                                  "rounded-b-none",
                              )}
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
                          {field.state.meta.errors.length > 0 && (
                            <div className="text-red-500 bg-black text-xs font-mono whitespace-pre overflow-x-auto">
                              {field.state.meta.errors.join(", ")}
                            </div>
                          )}
                        </div>
                      )}
                    />
                    <form.Field
                      name="select"
                      children={(field) => (
                        <div className="flex flex-col gap-2">
                          <Label className="inline-flex items-center gap-2">
                            {React.createElement(nodeIcons["SelectNode"])}
                            Select
                          </Label>
                          {field.state.value.map((expr, i) => (
                            <form.Field
                              key={i}
                              name={`select[${i}]`}
                              validators={{
                                onChangeAsync: async ({ value }) => {
                                  if (value) return await checkSyntax(value);
                                },
                                onChangeAsyncDebounceMs: SYNTAX_CHECK_DELAY,
                              }}
                              children={(subField) => (
                                <div
                                  key={i}
                                  className="grid grid-cols-[1fr_min-content] w-full flex-row gap-2 gap-y-0 items-center"
                                >
                                  <InputGroup>
                                    <InputGroupAddon align="inline-end">
                                      <CheatsheetContextTrigger />
                                    </InputGroupAddon>
                                    <InputGroupInput
                                      type="text"
                                      className={cn(
                                        "w-full font-mono",
                                        subField.state.meta.errors.length > 0 &&
                                          "rounded-b-none",
                                      )}
                                      value={expr}
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
                                  </InputGroup>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    type="button"
                                    onClick={() => field.removeValue(i)}
                                  >
                                    -
                                  </Button>
                                  {subField.state.meta.errors.length > 0 && (
                                    <div className="text-red-500 bg-black text-xs font-mono whitespace-pre overflow-x-auto">
                                      {subField.state.meta.errors.join(", ")}
                                    </div>
                                  )}
                                </div>
                              )}
                            />
                          ))}
                          <div className="flex justify-start">
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => field.pushValue("")}
                            >
                              + add select
                            </Button>
                          </div>
                        </div>
                      )}
                    />
                    <form.Subscribe
                      selector={(state) => [
                        state.canSubmit,
                        state.isSubmitting,
                      ]}
                      children={([canSubmit, isSubmitting]) => (
                        <div className="flex self-end flex-row gap-2 justify-end">
                          <Button
                            variant="ghost"
                            type="button"
                            onClick={() => {
                              setOptions(DEFAULT_READ_OPTIONS);
                              form.reset();
                            }}
                          >
                            Reset
                          </Button>
                          <Button
                            type="submit"
                            disabled={!canSubmit}
                            className="btn btn-primary"
                          >
                            {isSubmitting || isFetching ? <Spinner /> : "Apply"}
                          </Button>
                        </div>
                      )}
                    />
                  </form>
                </DialogHeader>

                {!error && (
                  <Table>
                    <TableHeader>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                          {headerGroup.headers.map((header) => {
                            return (
                              <TableHead key={header.id}>
                                {header.isPlaceholder
                                  ? null
                                  : flexRender(
                                      header.column.columnDef.header,
                                      header.getContext(),
                                    )}
                              </TableHead>
                            );
                          })}
                        </TableRow>
                      ))}
                    </TableHeader>
                    <TableBody>
                      {table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                          <TableRow key={row.id}>
                            {row.getVisibleCells().map((cell) => (
                              <TableCell key={cell.id}>
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell
                            colSpan={columnsDef.length}
                            className="h-24 text-center"
                          >
                            {isLoading ? "Loading..." : "No results"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}

                {!!error && (
                  <Alert
                    variant="destructive"
                    className="w-auto mx-auto self-start"
                  >
                    <AlertCircleIcon />
                    <AlertTitle>Error reading data</AlertTitle>
                    <AlertDescription>
                      <p>{error.toString()}</p>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              <CheatsheetContext className="mt-6 max-w-[500px] flex-1" />
            </div>
            {data?.data && (
              <DialogFooter className="flex sm:flex-row sm:justify-between text-sm">
                <div className="text-sm">
                  Showing {table.getRowModel().rows.length.toLocaleString()} of{" "}
                  {data?.total.toLocaleString()} Rows
                </div>

                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationFirst
                        onClick={() =>
                          table.getCanPreviousPage() && table.firstPage()
                        }
                        className={cn(
                          !table.getCanPreviousPage() && "opacity-50",
                        )}
                        href="#"
                      />
                    </PaginationItem>
                    <PaginationItem
                      onClick={() =>
                        table.getCanPreviousPage() && table.previousPage()
                      }
                      className={cn(
                        !table.getCanPreviousPage() && "opacity-50",
                      )}
                    >
                      <PaginationPrevious href="#" />
                    </PaginationItem>

                    {paginationItems.map((page) => (
                      <PaginationItem
                        key={page}
                        onClick={() => table.setPageIndex(page - 1)}
                      >
                        <PaginationLink
                          size="sm"
                          href="#"
                          isActive={page == options.page}
                        >
                          {page == options.page && isFetching ? (
                            <Spinner />
                          ) : (
                            page
                          )}
                        </PaginationLink>
                      </PaginationItem>
                    ))}

                    {options.page + 3 <
                      Math.ceil(data?.total / options.page_size) && (
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    )}

                    <PaginationItem>
                      <PaginationNext
                        onClick={() =>
                          table.getCanNextPage() && table.nextPage()
                        }
                        className={cn(!table.getCanNextPage() && "opacity-50")}
                        href="#"
                      />
                    </PaginationItem>
                    <PaginationItem
                      onClick={() => table.getCanNextPage() && table.lastPage()}
                      className={cn(!table.getCanNextPage() && "opacity-50")}
                    >
                      <PaginationLast href="#" />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>

                <Select
                  name="page_size"
                  value={table.getState().pagination.pageSize.toString()}
                  onValueChange={(e) => {
                    table.setPageSize(Number(e));
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select a fruit" />
                  </SelectTrigger>
                  <SelectContent>
                    {[100, 200, 300, 1000, 5000, 10000].map((pageSize) => (
                      <SelectItem key={pageSize} value={pageSize.toString()}>
                        Show {pageSize}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </CheatsheetProvider>
    </>
  );
});
