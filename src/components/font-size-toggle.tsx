"use client";

import { useFontSize } from "./font-size-provider";

const labels: Record<string, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

export function FontSizeToggle() {
  const { fontSize, cycle } = useFontSize();

  return (
    <button
      onClick={cycle}
      className="p-2 text-content-tertiary hover:text-content-secondary hover:bg-surface-elevated rounded-lg transition-all flex-shrink-0"
      title={`Font size: ${labels[fontSize]}`}
    >
      {fontSize === "small" ? (
        <span className="w-[18px] h-[18px] flex items-center justify-center font-medium text-[11px] leading-none">A</span>
      ) : fontSize === "medium" ? (
        <span className="w-[18px] h-[18px] flex items-center justify-center font-medium text-[14px] leading-none">A</span>
      ) : (
        <span className="w-[18px] h-[18px] flex items-center justify-center font-medium text-[17px] leading-none">A</span>
      )}
    </button>
  );
}
