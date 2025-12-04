import type { AnyFieldApi } from "@tanstack/react-form";
import { ScaleLoader } from "react-spinners";

export function FieldInfo({ field }: { field: AnyFieldApi }) {
  return (
    <>
      {field.state.meta.isTouched && !field.state.meta.isValid ? (
        <em className="text-red-500">{field.state.meta.errors.join(", ")}</em>
      ) : null}
      {field.state.meta.isValidating ? (
        <ScaleLoader height={20} width={5} color="#fff" />
      ) : null}
    </>
  );
}
