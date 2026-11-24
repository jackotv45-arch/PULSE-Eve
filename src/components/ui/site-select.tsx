import type { CSSProperties } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SiteSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type SiteSelectProps = {
  id?: string;
  name?: string;
  value: string;
  placeholder: string;
  options: SiteSelectOption[];
  onValueChange: (value: string) => void;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  describedBy?: string | undefined;
  ariaLabel?: string;
};

export function SiteSelect({
  id,
  name,
  value,
  placeholder,
  options,
  onValueChange,
  className,
  style,
  disabled,
  required,
  invalid,
  describedBy,
  ariaLabel,
}: SiteSelectProps) {
  return (
    <Select
      name={name}
      value={value || undefined}
      onValueChange={onValueChange}
      disabled={disabled}
      required={required}
    >
      <SelectTrigger
        id={id}
        className={`${className ?? ""} site-select-trigger`}
        style={style}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="site-select-content" position="popper">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            className="site-select-item"
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
