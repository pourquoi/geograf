import React, {
  useState,
  createContext,
  useContext,
  memo,
  ComponentProps,
} from "react";
import { Button } from "@/components/ui/button";
import { LucideHelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { InputGroupButton } from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import doc from "./doc";
import { nodeIcons } from "../Flow";
import { LuChevronLeft } from "react-icons/lu";

const Cheatsheet = memo(
  ({ onClose, ...props }: { onClose?: () => void } & ComponentProps<"div">) => {
    return (
      <div
        {...props}
        className={cn(
          "relative flex flex-col items-center gap-2",
          props.className,
        )}
      >
        <div className="flex gap-2 items-center">
          <Button variant="ghost" onClick={onClose}>
            <LuChevronLeft />
          </Button>
          Cheatsheet
        </div>
        <ScrollArea className="max-h-dvh-safe-[85dvh] max-w-[calc(100vw-2rem)] w-auto flex flex-col rounded-md border-none p-4">
          <div className="flex flex-col gap-4">
            {doc.cheatsheet.map((cheat, i) => (
              <div key={i} className="flex flex-col gap-2 p-0">
                <div className="flex items-center gap-2">
                  {React.createElement(nodeIcons[cheat.icon])} {cheat.category}
                </div>
                <div>
                  {cheat.examples.map((ex, i) => (
                    <div key={i} className="mb-3">
                      <code className="font-mono text-sm bg-muted px-3 py-2 rounded block">
                        {ex}
                      </code>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <Table className="">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center" colSpan={2}>
                    Methods
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doc.reference.methods.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm bg-muted/50">
                      {f.name}
                      <br />
                      <span className="text-muted-foreground text-xs">
                        {f.example}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center" colSpan={2}>
                    Functions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doc.reference.functions.map((f, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm bg-muted/50">
                      {f.name}
                      <br />
                      <span className="text-muted-foreground text-xs">
                        {f.example}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ScrollArea>
      </div>
    );
  },
);

type CheatsheetContext = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

export const cheatsheetContext = createContext<CheatsheetContext>({
  open: false,
  setOpen: () => {},
  toggle: () => {},
});
export const CheatsheetProvider = ({
  children,
  onOpenChange,
}: {
  children: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}) => {
  const [open, setOpen] = useState(false);
  const handleOpenChange = (open: boolean) => {
    setOpen(open);
    onOpenChange?.(open);
  };
  return (
    <cheatsheetContext.Provider
      value={{
        open,
        setOpen: handleOpenChange,
        toggle: () => handleOpenChange(!open),
      }}
    >
      {children}
    </cheatsheetContext.Provider>
  );
};

export default Cheatsheet;

export const CheatsheetContext = (props: ComponentProps<typeof Cheatsheet>) => {
  const { open, setOpen } = useContext(cheatsheetContext);
  if (!open) return null;
  return <Cheatsheet {...props} onClose={() => setOpen(false)} />;
};

export const CheatsheetContextTrigger = () => {
  const { toggle } = useContext(cheatsheetContext);
  return (
    <InputGroupButton type="button" variant="ghost" onClick={() => toggle()}>
      <LucideHelpCircle />
    </InputGroupButton>
  );
};
