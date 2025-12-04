import { Flow } from "@/bindings/Flow";
import { useFlow, useFlowDelete, useFlows } from "./hooks";
import CreateFlowCard from "./components/CreateFlowCard";
import FlowCard from "./components/FlowCard";

const HubView = ({
  onClose,
  onSwitch,
}: {
  onClose?: () => void;
  onSwitch?: (flow: Flow) => void;
}) => {
  const { flow: currentFlow, switchFlow } = useFlow();
  const { data: flows } = useFlows();
  const { mutate: deleteFlow } = useFlowDelete();

  const onSelectFlow = (flow: Flow) => {
    if (flow.id !== currentFlow) {
      switchFlow(flow.id);
      onSwitch?.(flow);
    } else {
      onClose?.();
    }
  };

  return (
    <div className="flex align-center align-center flex-col w-100 h-100 overflow-auto justify-center w-screen h-screen p-4">
      <div className="flex flex-1 flex-col justify-center align-center">
        <CreateFlowCard onCreated={onSelectFlow} />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 p-2 mx-auto">
          {flows?.map((flow) => (
            <FlowCard
              key={flow.id}
              flow={flow}
              onSelect={() => onSelectFlow(flow)}
              onDelete={() => deleteFlow(flow.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default HubView;
