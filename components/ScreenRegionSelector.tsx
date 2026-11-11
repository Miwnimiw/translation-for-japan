"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Check, RotateCcw, X, Scissors } from "lucide-react";

interface ScreenRegionSelectorProps {
  sourceCanvas: HTMLCanvasElement;
  onConfirm: (croppedCanvas: HTMLCanvasElement) => void;
  onCancel: () => void;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export default function ScreenRegionSelector({
  sourceCanvas,
  onConfirm,
  onCancel,
}: ScreenRegionSelectorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<Rect | null>(null);

  // Layout parameters for fitting the image in the viewport with letterboxing
  const [layout, setLayout] = useState<{
    drawX: number;
    drawY: number;
    drawW: number;
    drawH: number;
    scale: number;
  }>({
    drawX: 0,
    drawY: 0,
    drawW: 0,
    drawH: 0,
    scale: 1,
  });

  // Calculate layout geometry based on window size
  const calculateLayout = useCallback(() => {
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const imgW = sourceCanvas.width;
    const imgH = sourceCanvas.height;

    const imgRatio = imgW / imgH;
    const viewRatio = viewW / viewH;

    let drawW: number, drawH: number, drawX: number, drawY: number;

    if (viewRatio > imgRatio) {
      drawH = viewH;
      drawW = viewH * imgRatio;
      drawX = (viewW - drawW) / 2;
      drawY = 0;
    } else {
      drawW = viewW;
      drawH = viewW / imgRatio;
      drawX = 0;
      drawY = (viewH - drawH) / 2;
    }

    const scale = imgW / drawW;
    setLayout({ drawX, drawY, drawW, drawH, scale });

    if (canvasRef.current) {
      canvasRef.current.width = viewW;
      canvasRef.current.height = viewH;
    }
  }, [sourceCanvas]);

  // Redraw the canvas scene
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { drawX, drawY, drawW, drawH } = layout;
    const viewW = canvas.width;
    const viewH = canvas.height;

    // 1. Clear background
    ctx.clearRect(0, 0, viewW, viewH);

    // 2. Draw captured base image
    ctx.drawImage(sourceCanvas, drawX, drawY, drawW, drawH);

    // 3. Draw semi-transparent dimming mask over whole screen
    ctx.fillStyle = "rgba(0, 0, 0, 0.58)";
    ctx.fillRect(0, 0, viewW, viewH);

    // 4. If selection exists, reveal the bright region inside the selection
    if (currentRect && currentRect.w > 3 && currentRect.h > 3) {
      const { x, y, w, h } = currentRect;

      // Restore the bright image inside the rectangle
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.drawImage(sourceCanvas, drawX, drawY, drawW, drawH);
      ctx.restore();

      // Draw crisp highlight border
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      // Draw corner anchor dots
      const cornerSize = 7;
      ctx.fillStyle = "#38bdf8";
      // Top-Left
      ctx.fillRect(x - cornerSize / 2, y - cornerSize / 2, cornerSize, cornerSize);
      // Top-Right
      ctx.fillRect(x + w - cornerSize / 2, y - cornerSize / 2, cornerSize, cornerSize);
      // Bottom-Left
      ctx.fillRect(x - cornerSize / 2, y + h - cornerSize / 2, cornerSize, cornerSize);
      // Bottom-Right
      ctx.fillRect(x + w - cornerSize / 2, y + h - cornerSize / 2, cornerSize, cornerSize);

      // Draw dimension badge
      const nativeW = Math.round(w * layout.scale);
      const nativeH = Math.round(h * layout.scale);
      const label = `${nativeW} × ${nativeH} px`;

      ctx.font = "12px monospace";
      const textWidth = ctx.measureText(label).width;
      const badgeH = 20;
      const badgeW = textWidth + 14;
      const badgeX = x;
      const badgeY = y > badgeH + 6 ? y - badgeH - 4 : y + h + 6;

      ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#f8fafc";
      ctx.fillText(label, badgeX + 7, badgeY + 14);
    }
  }, [layout, sourceCanvas, currentRect]);

  // Initial layout and resize observer
  useEffect(() => {
    calculateLayout();
    window.addEventListener("resize", calculateLayout);
    return () => window.removeEventListener("resize", calculateLayout);
  }, [calculateLayout]);

  // Trigger redraw on state change
  useEffect(() => {
    redraw();
  }, [redraw]);

  // Crop the selected region and return as canvas
  const handleConfirmCrop = useCallback(() => {
    if (!currentRect || currentRect.w < 5 || currentRect.h < 5) return;

    const { drawX, drawY, drawW, drawH, scale } = layout;

    // Clamp selection rectangle to visible image boundaries
    const clampedX = Math.max(drawX, Math.min(currentRect.x, drawX + drawW));
    const clampedY = Math.max(drawY, Math.min(currentRect.y, drawY + drawH));
    const clampedRight = Math.max(
      drawX,
      Math.min(currentRect.x + currentRect.w, drawX + drawW)
    );
    const clampedBottom = Math.max(
      drawY,
      Math.min(currentRect.y + currentRect.h, drawY + drawH)
    );

    const actualW = clampedRight - clampedX;
    const actualH = clampedBottom - clampedY;

    if (actualW < 5 || actualH < 5) return;

    // Map to native image coordinates
    const nativeCropX = Math.round((clampedX - drawX) * scale);
    const nativeCropY = Math.round((clampedY - drawY) * scale);
    const nativeCropW = Math.round(actualW * scale);
    const nativeCropH = Math.round(actualH * scale);

    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = nativeCropW;
    croppedCanvas.height = nativeCropH;
    const cropCtx = croppedCanvas.getContext("2d");
    if (!cropCtx) return;

    cropCtx.drawImage(
      sourceCanvas,
      nativeCropX,
      nativeCropY,
      nativeCropW,
      nativeCropH,
      0,
      0,
      nativeCropW,
      nativeCropH
    );

    onConfirm(croppedCanvas);
  }, [currentRect, layout, onConfirm, sourceCanvas]);

  // Keyboard shortcut listener for Enter and Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleConfirmCrop();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleConfirmCrop, onCancel]);

  // Mouse interaction handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDragging(true);
    setStartPoint({ x, y });
    setCurrentRect({ x, y, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !startPoint) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const x = Math.min(startPoint.x, currentX);
    const y = Math.min(startPoint.y, currentY);
    const w = Math.abs(currentX - startPoint.x);
    const h = Math.abs(currentY - startPoint.y);

    setCurrentRect({ x, y, w, h });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setCurrentRect(null);
    setStartPoint(null);
  };

  const hasSelection = currentRect !== null && currentRect.w >= 8 && currentRect.h >= 8;

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-black select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Screen Region Selection Overlay"
    >
      {/* Interactive Selection Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className="w-full h-full block cursor-crosshair"
      />

      {/* Floating Instructions & Controls Header */}
      <div className="pointer-events-none fixed top-5 inset-x-0 flex justify-center z-10 px-4">
        <div className="pointer-events-auto flex items-center gap-3 bg-slate-900/90 text-white text-xs px-4 py-2.5 rounded-full border border-slate-700 shadow-2xl backdrop-blur-md">
          <Scissors size={15} className="text-sky-400" />
          <span>คลิกเมาส์ค้างแล้วลากเพื่อครอบข้อความที่ต้องการ</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300">
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px]">
              Enter
            </kbd>{" "}
            เพื่อยืนยัน ·{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[11px]">
              Esc
            </kbd>{" "}
            เพื่อยกเลิก
          </span>
        </div>
      </div>

      {/* Floating Action Controls Bar (Bottom) */}
      <div className="fixed bottom-6 inset-x-0 flex justify-center z-10 px-4">
        <div className="flex items-center gap-2 bg-slate-900/95 p-2 rounded-xl border border-slate-700 shadow-2xl backdrop-blur-md">
          <button
            onClick={handleConfirmCrop}
            disabled={!hasSelection}
            className="focus-ring inline-flex items-center gap-1.5 bg-sky-500 hover:bg-sky-600 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-medium rounded-lg px-4 py-2.5 transition-colors cursor-pointer disabled:cursor-not-allowed shadow-sm"
          >
            <Check size={14} />
            Capture / Extract Text (Enter)
          </button>

          {hasSelection && (
            <button
              onClick={handleReset}
              className="focus-ring inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 transition-colors"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          )}

          <button
            onClick={onCancel}
            className="focus-ring inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 px-3 py-2.5 transition-colors"
          >
            <X size={14} />
            Cancel (Esc)
          </button>
        </div>
      </div>
    </div>
  );
}

