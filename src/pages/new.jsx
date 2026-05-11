import React, { useState, useRef } from "react";

const ImageComparison = () => {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef(null);

  const handleMove = (e) => {
    if (!containerRef.current) return;

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    if (clientX === undefined) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(position);
  };

  const handleMouseDown = () => {
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleMove);
    window.addEventListener("touchend", handleMouseUp);
  };

  const handleMouseUp = () => {
    window.removeEventListener("mousemove", handleMove);
    window.removeEventListener("mouseup", handleMouseUp);
    window.removeEventListener("touchmove", handleMove);
    window.removeEventListener("touchend", handleMouseUp);
  };

  return (
    <div className="w-full bg-background py-16 px-6 border-t border-border">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
            Before & After Results
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See the transformation our platform brings to your feedback and
            analytics process.
          </p>
        </div>

        <div
          ref={containerRef}
          className="relative max-w-5xl mx-auto aspect-video rounded-2xl overflow-hidden shadow-2xl cursor-default select-none border-4 border-white/10"
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        >
          {/* Image 2 (Revealed - Bottom Layer) */}
          <div className="absolute inset-0">
            <img
              src="/img2.jpg"
              alt="After"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Image 1 (Original - Top Layer with Clip Path) */}
          <div
            className="absolute inset-0 z-10 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
          >
            <img
              src="/img1.jpg"
              alt="Before"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Separator Line */}
          <div
            className="absolute top-0 bottom-0 z-20 w-[2px] bg-[#a855f7] flex items-center justify-center pointer-events-none"
            style={{ left: `calc(${sliderPos}% - 1px)` }}
          >
            {/* Circular Handle */}
            <div className="absolute w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center pointer-events-auto border-2 border-white transition-transform active:scale-90 translate-x-[0px]">
              <div className="flex gap-2 items-center">
                <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
                  <path
                    d="M7 1L2 6L7 11"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <svg width="8" height="12" viewBox="0 0 8 12" fill="none">
                  <path
                    d="M1 1L6 6L1 11"
                    stroke="#a855f7"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Status Badges */}
          <div className="absolute top-6 left-6 z-30 pointer-events-none">
            <div className="bg-black/40 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-sm font-semibold border border-white/20">
              Original Workflow
            </div>
          </div>
          <div className="absolute top-6 right-6 z-30 pointer-events-none">
            <div className="bg-primary/80 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-sm font-semibold border border-white/20">
              With Insights Hub
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageComparison;
