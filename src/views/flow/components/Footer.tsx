import { ComponentProps } from "react";
import ExecutionLogs from "./ExecutionLogs";
import { cn } from "@/lib/utils";

type Props = {
  nodeId: string;
};

const Footer = ({ nodeId, ...props }: Props & ComponentProps<"div">) => {
  return (
    <div {...props} className={cn("mt-2", props.className)}>
      <ExecutionLogs nodeId={nodeId} />
    </div>
  );
};

export default Footer;
