import React, { createContext, useEffect, useState } from "react";
import useIsMobile from "./hooks/use-is-mobile";
import { Position } from "@xyflow/react";

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

type AppConfig = {
  inputSide: Position;
  outputSide: Position;
};

const appConfigContext = createContext<{
  config: AppConfig;
  setConfig: (config: AppConfig) => void;
}>({
  config: { inputSide: Position.Left, outputSide: Position.Right },
  setConfig: () => {},
});

const AppConfigProvider = ({ children }: { children: React.ReactNode }) => {
  const { isMobile } = useIsMobile();

  const [config, setConfig] = useState<AppConfig>({
    inputSide: Position.Left,
    outputSide: Position.Right,
  });

  useEffect(() => {
    if (isMobile) {
      setConfig({
        ...config,
        // inputSide: Position.Top,
        // outputSide: Position.Bottom,
      });
    } else {
      setConfig({
        ...config,
        inputSide: Position.Left,
        outputSide: Position.Right,
      });
    }
  }, [isMobile]);

  return (
    <appConfigContext.Provider value={{ config, setConfig }}>
      {children}
    </appConfigContext.Provider>
  );
};

export { flowContext, FlowProvider, appConfigContext, AppConfigProvider };
