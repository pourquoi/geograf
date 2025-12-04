import { LuDatabase, LuMoveRight, LuPencil } from "react-icons/lu";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { MoreHorizontalIcon } from "lucide-react";
import { nodeIcons, nodeLabels } from "@/views/flow/Flow";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Flow } from "@/bindings/Flow";
import { useDuplicateFlow, useFlow, useFlowForm } from "../hooks";
import { exportFlow } from "@/commands";
import { toast } from "sonner";

type FlowNodeBadge = {
  label: string;
  count: number;
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
};

const FlowCard = ({
  flow,
  onSelect,
  onDelete,
}: {
  flow: Flow;
  onSelect?: () => void;
  onDelete?: () => void;
}) => {
  const { flow: currentFlow, switchFlow } = useFlow();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [nodes, setNodes] = useState<{ [key: string]: FlowNodeBadge }>({});
  const { form, mutation } = useFlowForm(flow);
  const { mutate: duplicate, data: duplicated } = useDuplicateFlow(flow.id);

  useEffect(() => {
    if (mutation.data) {
      setShowForm(false);
    }
  }, [mutation.data]);

  useEffect(() => {
    if (duplicated) {
      toast.success("Flow duplicated", {});
    }
  }, [duplicated]);

  useEffect(() => {
    const projectNodes = flow.nodes.reduce(
      (acc, node) => {
        if (node.type) {
          acc[node.type] = acc[node.type] || {
            label: nodeLabels[node.type] || node.type.replace("Node", ""),
            count: 0,
            icon: nodeIcons[node.type] || LuDatabase,
          };
          acc[node.type].count++;
        }
        return acc;
      },
      {} as { [key: string]: FlowNodeBadge },
    );
    setNodes(projectNodes);
  }, [flow]);

  const onExport = () => {
    exportFlow(flow.id);
  };

  return (
    <>
      <Card
        className={cn("w-[300px]", flow.id === currentFlow && "border-white")}
      >
        <CardHeader className="flex justify-between items-center">
          <CardTitle>{flow.name}</CardTitle>
          {!showForm && (
            <ButtonGroup>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowForm(true)}
              >
                <LuPencil />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="icon">
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="z-250">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => onExport()}>
                      Export
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => duplicate()}>
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setShowDeleteDialog(true)}>
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </ButtonGroup>
          )}
        </CardHeader>
        <CardContent className="flex-1">
          {showForm ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
              className="grid items-start gap-2"
            >
              <div className="flex mb-4 flex-col gap-2">
                <form.Field
                  name="name"
                  children={(field) => (
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
                  )}
                />
              </div>
              <div className="mt-2">
                <form.Subscribe
                  selector={(state) => [state.canSubmit, state.isSubmitting]}
                  children={([canSubmit, isSubmitting]) => (
                    <div className="flex flex-row gap-2 justify-end">
                      <Button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="btn btn-secondary"
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
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-8 gap-y-2">
              {Object.values(nodes).map((node) => (
                <div
                  key={node.label}
                  className="flex gap-2 items-center justify-between"
                >
                  <div className="flex text-gray-500 gap-2 items-center">
                    <node.icon className="w-5 h-5" />
                    <span className="text-sm">{node.label}</span>
                  </div>
                  <span className="text-sm">{node.count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        {!showForm && (
          <CardFooter className="flex justify-end flex-row gap-2">
            <Button onClick={() => onSelect?.()}>
              Open <LuMoveRight />
            </Button>
          </CardFooter>
        )}

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="z-250">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete project</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this flow?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete?.()}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </>
  );
};

export default FlowCard;
