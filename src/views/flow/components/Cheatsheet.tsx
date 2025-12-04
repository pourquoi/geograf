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
        className={cn("relative flex flex-col gap-2", props.className)}
      >
        <div className="flex gap-2 items-center">
          <Button variant="ghost" onClick={onClose}>
            <LuChevronLeft />
          </Button>
          Cheatsheet
        </div>
        <ScrollArea className="max-h-[calc(75vh)] rounded-md border p-4">
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

            <Table>
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
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.example}
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
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {f.example}
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
}: {
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <cheatsheetContext.Provider
      value={{ open, setOpen, toggle: () => setOpen(!open) }}
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
