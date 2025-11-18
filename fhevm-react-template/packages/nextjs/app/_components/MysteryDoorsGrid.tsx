import "~~/styles/mystery-doors.css";
import React from "react";

/**
 * Fixed overlay grid sized to match the doors background exactly.
 * Measurements:
 *  - Canvas: 1024x1536
 *  - Cells: 160x280
 *  - Gap (gutter): 24
 *  - Padding: 64 (L/R), 20 (T/B)
 */
export function MysteryDoorsGridMeasured({
  bgUrl,
  onCellClick,
  isSelected,
  isDoorOccupied,
  className = "",
}: {
  bgUrl: string;
  onCellClick?: (index: number) => void;
  isSelected: (index: number) => boolean;
  isDoorOccupied?: (index: number) => boolean;
  className?: string;
}) {
  // constants derived from the background image layout
  const CANVAS_W = 1024;
  const CANVAS_H = 1536;
  const CELL_W = 160;
  const CELL_H = 224;
  const GUTTER = 24;   // space between cells
  const PAD_X = 64;    // left/right padding
  const PAD_Y = 20;    // top/bottom padding

  const cells = Array.from({ length: 25 }, (_, i) => i + 1);

  const handleActivate = (i: number) => onCellClick?.(i);
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    i: number
  ) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleActivate(i);
    }
  };

  return (
    <div
      className={`snap-start relative mx-auto rounded-2xl shadow-lg overflow-hidden mystery-doors-container ${className}`}
      aria-label="Las Puertas del Misterio 5×5 measured grid"
    >
      {/* 1px-ish lines via gap over a dark backdrop */}
      <div
        className="h-full w-full grid mystery-doors-grid"
      >
        {cells.map((n, i) => {
          const active = isSelected(n);
          const occupied = isDoorOccupied ? isDoorOccupied(n) : false ;
          const deriveClasses = () => {
            if (active && occupied) {
              return "bg-gray-400/80 text-white shadow-lg scale-105 border-emerald-200 border-12";
            } else if (active) {
              return "bg-blue-400/40 text-white shadow-lg scale-105";
            } else if (occupied) {
              return "bg-gray-400/80 text-white shadow-lg scale-105";
            } else {
              return "bg-red-100/40 hover:bg-white text-gray-800";
            }
          }
          return (
            <div
              key={n}
              role="button"
              tabIndex={0}
              aria-label={`Door cell ${n}`}
              onClick={() => handleActivate(n)}
              className={`mystery-cell flex items-center justify-center
                       select-none cursor-pointer transition-transform duration-150
                       hover:scale-[1.03] active:scale-[0.98] rounded-lg  ${deriveClasses()}`}
            >
              <span className="text-neutral-900/90 font-semibold text-xl drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
                {n}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
