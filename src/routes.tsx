import {
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
} from "@tanstack/react-router";
import App from "./App";
import FlowView from "./views/flow/FlowView";
import { useContext } from "react";
import { flowContext } from "./providers";
import HubView from "./views/hub/HubView";

const rootRoute = createRootRoute({
  component: () => <App />,
});

const appIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => {
    const navigate = useNavigate();
    const { flow } = useContext(flowContext);

    if (flow) {
      navigate({ to: "/flow" });
    }

    return (
      <div>
        <HubView />
      </div>
    );
  },
});

const projectsIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/flow",
  component: () => {
    const navigate = useNavigate();
    const { flow } = useContext(flowContext);
    if (!flow) {
      navigate({ to: "/" });
    }
    return <FlowView />;
  },
});

const routeTree = rootRoute.addChildren([appIndexRoute, projectsIndexRoute]);

const router = createRouter({
  routeTree,
});

export default router;
