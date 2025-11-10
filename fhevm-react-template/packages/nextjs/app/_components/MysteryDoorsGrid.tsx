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
  className = "",
}: {
  bgUrl: string;
  onCellClick?: (index: number) => void;
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
      className={`relative mx-auto rounded-2xl shadow-lg overflow-hidden ${className}`}
      style={{
        width: CANVAS_W,
        height: CANVAS_H,
        backgroundColor: "rgb(228, 222, 215)",
        backgroundImage: `url("${bgUrl}")`,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        backgroundSize: `${CANVAS_W}px ${CANVAS_H}px`, // exact fit
        //boxSizing: "border-box",
        padding: `220px 60px 200px 60px`,
      }}
      aria-label="Las Puertas del Misterio 5×5 measured grid"
    >
      {/* 1px-ish lines via gap over a dark backdrop */}
      <div
        className="h-full w-full grid"
        style={{
          gridTemplateColumns: `repeat(5, ${CELL_W}px)`,
          gridTemplateRows: `repeat(5, ${CELL_H}px)`,
          gap: `30px 24px`,
        }}
      >
        {cells.map((n, i) => (
          <div
            key={n}
            role="button"
            tabIndex={0}
            aria-label={`Door cell ${n}`}
            onClick={() => handleActivate(i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className="bg-red-100/40 flex items-center justify-center
                       select-none cursor-pointer transition-transform duration-150
                       hover:scale-[1.03] active:scale-[0.98] rounded-lg"
            style={{
              width: CELL_W,
              height: CELL_H,
            }}
          >
            <span className="text-neutral-900/90 font-semibold text-xl drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
              {n}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Example usage
------------------------------------------------- */
// import { MysteryDoorsGridMeasured } from "./MysteryDoorsGridMeasured";

export default function App() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[rgb(228,222,215)] p-8">
      <MysteryDoorsGridMeasured
        bgUrl="/images/A_flat_digital_2D_illustration_features_25_doors_a.png"
        onCellClick={(i) => alert(`Clicked cell #${i + 1}`)}
      />
    </div>
  );
}
