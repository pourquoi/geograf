import { useContext, useState } from "react";
import { createPortal } from "react-dom";
import { flowContext } from "../../providers";
import HubView from "../hub/HubView";
import Flow from "../flow/Flow";

const FlowView = () => {
  const { flow: flowId } = useContext(flowContext);
  const [showHubOverlay, setShowHubOverlay] = useState(false);

  return (
    <div>
      {flowId ? (
        <div className="relative">
          <Flow onSwitch={() => setShowHubOverlay(true)} />
        </div>
      ) : null}
      {showHubOverlay &&
        createPortal(
          <div className="fixed z-205 top-0 left-0 w-screen h-screen bg-background">
            <HubView
              onClose={() => setShowHubOverlay(false)}
              onSwitch={() => setShowHubOverlay(false)}
            />
          </div>,
          document.body,
        )}
    </div>
  );
};

export default FlowView;
