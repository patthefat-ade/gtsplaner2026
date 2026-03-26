"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TimePickerProps {
  value?: string; // "HH:mm" format
  onChange?: (time: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Minute step interval (default: 5) */
  minuteStep?: number;
}

/**
 * TimePicker component that displays time in 24h format (HH:mm).
 * Uses dropdown selects for hours and minutes instead of native browser input.
 */
export function TimePicker({
  value,
  onChange,
  placeholder = "Zeit waehlen",
  disabled = false,
  className,
  minuteStep = 5,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);

  const hours = React.useMemo(
    () => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")),
    [],
  );

  const minutes = React.useMemo(
    () =>
      Array.from(
        { length: Math.floor(60 / minuteStep) },
        (_, i) => String(i * minuteStep).padStart(2, "0"),
      ),
    [minuteStep],
  );

  const currentHour = value ? value.split(":")[0] : undefined;
  const currentMinute = value ? value.split(":")[1] : undefined;

  const handleHourChange = (hour: string) => {
    const minute = currentMinute || "00";
    onChange?.(`${hour}:${minute}`);
  };

  const handleMinuteChange = (minute: string) => {
    const hour = currentHour || "08";
    onChange?.(`${hour}:${minute}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <Clock className="mr-2 h-4 w-4" />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">
              Stunde
            </span>
            <Select value={currentHour} onValueChange={handleHourChange}>
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder="HH" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {hours.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-lg font-bold mt-4">:</span>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">
              Minute
            </span>
            <Select value={currentMinute} onValueChange={handleMinuteChange}>
              <SelectTrigger className="w-[70px]">
                <SelectValue placeholder="mm" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {minutes.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
