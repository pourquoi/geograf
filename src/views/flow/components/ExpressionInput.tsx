import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import React, { useRef, useState } from "react";
import { FieldApi, useField } from "@tanstack/react-form";

function getCaretClientRect(input: HTMLInputElement) {
  const style = window.getComputedStyle(input);

  const mirror = document.createElement("div");
  mirror.style.position = "absolute";
  mirror.style.whiteSpace = "pre";
  mirror.style.visibility = "hidden";

  const props = [
    "fontFamily",
    "fontSize",
    "fontWeight",
    "letterSpacing",
    "textTransform",
    "padding",
    "border",
  ];
  props.forEach((p: any) => (mirror.style[p] = style[p]));

  const value = input.value;
  const pos = input.selectionStart ?? 0;

  mirror.textContent = value.substring(0, pos);
  const marker = document.createElement("span");
  marker.textContent = value.substring(pos) || ".";
  mirror.appendChild(marker);

  document.body.appendChild(mirror);

  const rect = marker.getBoundingClientRect();

  mirror.remove();

  return rect;
}

function getColContext(text: string, cursor: number) {
  const before = text.lastIndexOf("col(", cursor);

  if (before === -1) return null;

  const after = text.indexOf(")", before);
  if (after !== -1 && cursor > after) return null;

  return {
    start: before + 4,
    end: after === -1 ? cursor : after,
    inside: text.slice(before + 4, cursor),
  };
}

// todo: delete or finish this
const ExpressionInput = ({
  invalid,
  field,
  ...props
}: {
  invalid?: boolean;
  field: any;
} & Parameters<typeof Input>[0]) => {
  const ref = useRef<HTMLInputElement>(null);
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [match, setMatch] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>(["test"]);

  function updatePosition() {
    if (!ref.current) return;
    const rect = getCaretClientRect(ref.current);
    setCoords({ top: 0, left: rect.left });
  }

  function handleInput(
    e:
      | React.InputEvent<HTMLInputElement>
      | React.KeyboardEvent<HTMLInputElement>,
  ) {
    props.onInput?.(e);
    const el = ref.current!;
    const pos = el.selectionStart ?? 0;
    const text = el.value;

    const ctx = getColContext(text, pos);

    if (ctx) {
      setShow(true);
      setMatch(ctx.inside);
      updatePosition();
    } else {
      setShow(false);
    }
  }

  function insertSuggestion(s: string) {
    const el = ref.current!;
    const pos = el.selectionStart!;
    const text = el.value;

    const ctx = getColContext(text, pos);
    if (!ctx) return;

    const newText = text.slice(0, ctx.start) + s + text.slice(ctx.end);

    field.setValue((updater: any) => {
      return newText;
    });
    setTimeout(() => {
      el.focus();
    });

    setShow(false);
  }

  return (
    <div className="relative">
      <Input
        ref={ref}
        type="text"
        onInput={handleInput}
        onKeyUp={handleInput}
        className={cn("font-mono")}
        {...props}
      />
      {show && (
        <div
          style={{
            position: "absolute",
            top: coords.top + 30,
            left: coords.left + 5,
            background: "white",
            color: "black",
            border: "1px solid #ccc",
            borderRadius: 4,
            padding: "5px",
            zIndex: 1000,
          }}
        >
          {suggestions.map((s) => (
            <div
              key={s}
              onMouseDown={() => insertSuggestion(s)}
              style={{ padding: "4px 8px", cursor: "pointer" }}
            >
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ExpressionInput;
