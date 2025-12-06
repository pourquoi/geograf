import { Flow } from "@/bindings/Flow";
import { LuPlus } from "react-icons/lu";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useFlow, useFlowForm } from "../hooks";
import { Demo } from "@/bindings/Demo";
import { listDemos } from "@/commands";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CreateFlowCard = ({
  onCreated,
}: {
  onCreated?: (flow: Flow) => void;
}) => {
  const { switchFlow } = useFlow();
  const { form, mutation } = useFlowForm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [demos, setDemos] = useState<Demo[]>([]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    form.handleSubmit();
  };

  useEffect(() => {
    if (mutation.data) {
      switchFlow(mutation.data.id);
      onCreated?.(mutation.data);
    }
  }, [mutation.data]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const demosGrouped = demos.reduce(
    (acc, demo) => {
      const cat = acc.find((g) => g.name === demo.category);
      if (cat) {
        cat.demos.push(demo);
      } else {
        acc.push({ name: demo.category, demos: [demo] });
      }
      return acc;
    },
    [] as { name: string; demos: Demo[] }[],
  );

  useEffect(() => {
    (async () => {
      const demos = await listDemos();
      setDemos(demos);
    })();
  }, []);

  return (
    <form
      onSubmit={onSubmit}
      className="py-4 self-center items-stretch md:items-center flex flex-col md:flex-row gap-2"
    >
      <form.Field
        name="name"
        validators={{
          onChange: ({ value }) => {
            if (value.length === 0) {
              return "Name is required";
            }
          },
        }}
        children={(field) => (
          <Input
            ref={inputRef}
            id={field.name}
            name={field.name}
            value={field.state.value}
            onChange={(e) => field.handleChange(e.currentTarget.value)}
            onBlur={field.handleBlur}
            placeholder="create new flow..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        )}
      />
      <form.Field
        name="demo"
        children={(field) => (
          <Select
            name={field.name}
            value={field.state.value}
            onValueChange={(e) => field.handleChange(e)}
          >
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Empty template" />
            </SelectTrigger>

            <SelectContent className="z-250">
              {demosGrouped.map((group) => (
                <SelectGroup key={group.name}>
                  <SelectLabel>{group.name}</SelectLabel>
                  {group.demos.map((demo) => (
                    <SelectItem key={demo.name} value={demo.name}>
                      {demo.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        )}
      />
      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
        children={([canSubmit, isSubmitting]) => (
          <>
            <Button
              className="hidden md:block"
              variant="ghost"
              size="sm"
              type="submit"
              disabled={!canSubmit}
            >
              {isSubmitting ? <Spinner /> : <LuPlus />}
            </Button>

            <Button
              variant="outline"
              className="block md:hidden btn btn-primary"
              type="submit"
              disabled={!canSubmit}
            >
              {isSubmitting ? <Spinner /> : "Create"}
            </Button>
          </>
        )}
      />
    </form>
  );
};

export default CreateFlowCard;
