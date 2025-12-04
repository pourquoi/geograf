import { Outlet } from "@tanstack/react-router";
import "./App.css";
import "@xyflow/react/dist/style.css";

function App() {
  return (
    <main className="flex flex-row bg-background text-foreground dark h-screen w-full">
      <Outlet />
    </main>
  );
}

export default App;
