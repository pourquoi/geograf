import { Input } from "@/components/ui/input";
import { createFormHookContexts } from "@tanstack/react-form";

const ExprField = () => {
  const { useFieldContext } = createFormHookContexts();
  const field = useFieldContext<string>();

  return (
    <Input
      type="text"
      className="font-mono"
      value={field.state.value}
      onChange={(e) => field.handleChange(e.currentTarget.value)}
      onBlur={field.handleBlur}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
    />
  );
};

export default ExprField;
