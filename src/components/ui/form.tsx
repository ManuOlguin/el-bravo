"use client";
import { createContext, forwardRef, useContext, useId, useState } from "react";
import { cn } from "./cn";

/* ------------------------------------------------------------------ */
/* Field: etiqueta + control + ayuda/error.                            */
/* Los controles dentro de un Field toman `id`, `aria-invalid` y        */
/* `aria-describedby` del contexto si no se los pasan explícitamente.   */
/* ------------------------------------------------------------------ */

type FieldCtx = { id: string; invalid: boolean; describedBy?: string };
const FieldContext = createContext<FieldCtx | null>(null);

function useFieldProps(props: { id?: string; invalid?: boolean; "aria-describedby"?: string }) {
  const ctx = useContext(FieldContext);
  const invalid = props.invalid ?? ctx?.invalid ?? false;
  return {
    id: props.id ?? ctx?.id,
    "aria-invalid": invalid || undefined,
    "aria-describedby": props["aria-describedby"] ?? ctx?.describedBy,
  };
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor: string;
  error?: string | null;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const errorId = `${htmlFor}-error`;
  const hintId = `${htmlFor}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <FieldContext.Provider value={{ id: htmlFor, invalid: !!error, describedBy }}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label htmlFor={htmlFor} className="text-sm font-semibold text-fg">
          {label}
        </label>
        {children}
        {hint && !error && (
          <p id={hintId} className="text-xs text-fg-subtle">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-xs text-danger">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Input / Textarea / Select                                           */
/* text-base (16 px) como mínimo para que iOS no haga zoom al enfocar.  */
/* ------------------------------------------------------------------ */

const control =
  "w-full rounded-xl border border-border bg-surface-2 text-base text-fg placeholder:text-fg-subtle " +
  "transition-colors focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 " +
  "aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-50";

type InvalidProp = { invalid?: boolean };

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & InvalidProp>(function Input(
  { className, invalid, id, ...rest },
  ref
) {
  const field = useFieldProps({ id, invalid, "aria-describedby": rest["aria-describedby"] });
  return <input ref={ref} {...rest} {...field} className={cn(control, "h-11 px-3", className)} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & InvalidProp>(
  function Textarea({ className, invalid, id, rows = 3, ...rest }, ref) {
    const field = useFieldProps({ id, invalid, "aria-describedby": rest["aria-describedby"] });
    return <textarea ref={ref} rows={rows} {...rest} {...field} className={cn(control, "min-h-11 px-3 py-2.5", className)} />;
  }
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & InvalidProp>(function Select(
  { className, invalid, id, children, ...rest },
  ref
) {
  const field = useFieldProps({ id, invalid, "aria-describedby": rest["aria-describedby"] });
  return (
    <div className="relative">
      <select ref={ref} {...rest} {...field} className={cn(control, "h-11 appearance-none pl-3 pr-10", className)}>
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/* NumberInput: el campo vacío es `null` (no 0); se clampa en onBlur.   */
/* Acepta coma o punto decimal y muestra coma (es-AR).                  */
/* ------------------------------------------------------------------ */

function formatNumber(v: number | null) {
  return v === null ? "" : String(v).replace(".", ",");
}

function parseNumber(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "" || t === "-" || t === "." || t === "-.") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const NUMBER_PATTERN = /^-?\d*([.,]\d*)?$/;

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
  suffix,
  id,
  name,
  placeholder,
  disabled,
  invalid,
  className,
  "aria-label": ariaLabel,
}: {
  value: number | null;
  onChange(v: number | null): void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: React.ReactNode;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const field = useFieldProps({ id, invalid });
  const [draft, setDraft] = useState(() => formatNumber(value));
  const [prevValue, setPrevValue] = useState(value);

  // Si el valor cambia desde afuera, sincronizar el texto (sin pisar lo que se está tipeando).
  if (value !== prevValue) {
    setPrevValue(value);
    if (parseNumber(draft) !== value) setDraft(formatNumber(value));
  }

  const clamp = (n: number) => {
    let r = n;
    if (min !== undefined) r = Math.max(min, r);
    if (max !== undefined) r = Math.min(max, r);
    return r;
  };

  return (
    <div className={cn("relative", className)}>
      <input
        {...field}
        name={name}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel}
        value={draft}
        onChange={(e) => {
          const text = e.target.value;
          if (!NUMBER_PATTERN.test(text)) return;
          setDraft(text);
          const parsed = parseNumber(text);
          setPrevValue(parsed);
          onChange(parsed);
        }}
        onBlur={() => {
          const parsed = parseNumber(draft);
          if (parsed === null) {
            setDraft("");
            return;
          }
          let next = clamp(parsed);
          if (step !== undefined && step > 0) {
            // Evita errores de punto flotante (0.1 + 0.2) al redondear al paso.
            const decimals = (String(step).split(".")[1] ?? "").length;
            next = Number((Math.round(next / step) * step).toFixed(decimals));
            next = clamp(next);
          }
          setDraft(formatNumber(next));
          if (next !== parsed) {
            setPrevValue(next);
            onChange(next);
          }
        }}
        className={cn(control, "h-11 px-3 tabular-nums", suffix ? "pr-14" : undefined)}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-fg-muted">{suffix}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slider                                                              */
/* ------------------------------------------------------------------ */

export function Slider({
  value,
  onChange,
  min,
  max,
  step,
  format,
  id,
  disabled,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange(v: number): void;
  min: number;
  max: number;
  step: number;
  format?(v: number): string;
  id?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const field = useFieldProps({ id });
  const text = format ? format(value) : String(value);
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <input
        id={field.id}
        aria-describedby={field["aria-describedby"]}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-valuetext={text}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 min-w-0 flex-1 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
      />
      <output htmlFor={field.id} className="w-14 shrink-0 text-right text-sm font-semibold tabular-nums">
        {text}
      </output>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Switch                                                              */
/* ------------------------------------------------------------------ */

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange(checked: boolean): void;
  label: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-semibold">
          {label}
        </label>
        {description && <p className="text-xs text-fg-muted">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
          "disabled:cursor-not-allowed disabled:opacity-50 active:scale-95",
          checked ? "border-primary bg-primary" : "border-border bg-surface-3"
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-5 w-5 rounded-full shadow transition-transform duration-150",
            checked ? "translate-x-6 bg-on-primary" : "translate-x-1 bg-fg-muted"
          )}
        />
      </button>
    </div>
  );
}
