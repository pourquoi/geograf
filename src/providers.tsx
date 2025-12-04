import React, { createContext, useState } from "react";

const flowContext = createContext<{
  flow: string | null;
  setFlow: (flow: string | null) => void;
}>({ flow: null, setFlow: () => {} });

const FlowProvider = ({ children }: { children: React.ReactNode }) => {
  const [flow, _setFlow] = useState<string | null>(null);

  const setFlow = (flow: string | null) => {
    _setFlow(flow);
  };

  return (
    <flowContext.Provider value={{ flow, setFlow }}>
      {children}
    </flowContext.Provider>
  );
};

export { flowContext, FlowProvider };
