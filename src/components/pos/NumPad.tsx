import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Delete } from "lucide-react";

interface Props {
  onSubmit: (value: number) => void;
}

export function NumPad({ onSubmit }: Props) {
  const [display, setDisplay] = useState("");

  const handleDigit = (digit: string) => {
    setDisplay((prev) => {
      const next = prev + digit;
      return next.length > 3 ? prev : next;
    });
  };

  const handleClear = () => setDisplay("");

  const handleSubmit = () => {
    const val = parseInt(display, 10);
    if (val > 0) {
      onSubmit(val);
      setDisplay("");
    }
  };

  return (
    <div className="border-t p-2">
      <div className="mb-2 flex items-center justify-between rounded-md border bg-background px-3 py-1.5">
        <span className="text-xs text-muted-foreground">Cant:</span>
        <span className="text-sm font-mono font-semibold text-foreground">
          {display || "0"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <Button key={d} variant="outline" size="sm" onClick={() => handleDigit(d)}>
            {d}
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={handleClear}>
          <Delete className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleDigit("0")}>
          0
        </Button>
        <Button variant="default" size="sm" onClick={handleSubmit}>
          OK
        </Button>
      </div>
    </div>
  );
}
