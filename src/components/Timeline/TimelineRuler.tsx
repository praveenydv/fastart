import React, { useRef, useEffect } from "react";
import { View, Text, Platform } from "react-native";
import { styles } from "./TimelineStyles";

export interface TimelineRulerProps {
  width: number;
  height?: number;
  ticks: { time: number; label: string; isMajor: boolean }[];
  pxPerSec: number;
  beatMarkers?: number[];
}

const TimelineWebCanvasRuler: React.FC<{
  width: number;
  height: number;
  ticks: { time: number; label: string; isMajor: boolean }[];
  pxPerSec: number;
  beatMarkers?: number[];
}> = React.memo(({ width, height, ticks, pxPerSec, beatMarkers }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    // Minor ticks
    ctx.beginPath();
    ctx.strokeStyle = "#374151";
    ctx.lineWidth = 1;
    for (let i = 0; i < ticks.length; i++) {
      const tk = ticks[i];
      if (!tk.isMajor) {
        const x = Math.round(tk.time * pxPerSec) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 5);
      }
    }
    ctx.stroke();

    // Major ticks
    ctx.beginPath();
    ctx.strokeStyle = "#64748B";
    ctx.lineWidth = 1;
    for (let i = 0; i < ticks.length; i++) {
      const tk = ticks[i];
      if (tk.isMajor) {
        const x = Math.round(tk.time * pxPerSec) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 8);
      }
    }
    ctx.stroke();

    // Text labels for ticks
    ctx.font = "9px monospace";
    ctx.textBaseline = "top";
    for (let i = 0; i < ticks.length; i++) {
      const tk = ticks[i];
      const x = Math.round(tk.time * pxPerSec);
      ctx.fillStyle = tk.isMajor ? "#CBD5E1" : "#64748B";
      ctx.fillText(tk.label, x + 2, 7);
    }

    // Beat markers
    if (beatMarkers && beatMarkers.length > 0) {
      ctx.fillStyle = "#FFE600";
      for (let i = 0; i < beatMarkers.length; i++) {
        const bx = Math.round(beatMarkers[i] * pxPerSec);
        ctx.beginPath();
        ctx.arc(bx, 5, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [width, height, ticks, pxPerSec, beatMarkers]);

  return (
    <canvas
      ref={canvasRef as any}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width,
        height,
        pointerEvents: "none",
      }}
    />
  );
});

const TimelineNativeRuler: React.FC<{
  ticks: { time: number; label: string; isMajor: boolean }[];
  pxPerSec: number;
  beatMarkers?: number[];
}> = React.memo(({ ticks, pxPerSec, beatMarkers }) => {
  return (
    <>
      {ticks.map((tk, i) => (
        <View
          key={i}
          style={[styles.tickWrapper, { left: tk.time * pxPerSec }]}
        >
          <View
            style={[
              styles.tickLine,
              tk.isMajor ? styles.tickLineMajor : null,
            ]}
          />
          <Text
            style={[
              styles.tickText,
              tk.isMajor && styles.tickTextMajor,
            ]}
          >
            {tk.label}
          </Text>
        </View>
      ))}
      {beatMarkers &&
        beatMarkers.map((beatTime, idx) => (
          <View
            key={`beat-${idx}`}
            style={{
              position: "absolute",
              left: beatTime * pxPerSec - 3,
              top: 3,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: "#FFE600",
              zIndex: 10,
            }}
          />
        ))}
    </>
  );
});

export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  width,
  height = 26,
  ticks,
  pxPerSec,
  beatMarkers,
}) => {
  if (Platform.OS === "web") {
    return (
      <TimelineWebCanvasRuler
        width={width}
        height={height}
        ticks={ticks}
        pxPerSec={pxPerSec}
        beatMarkers={beatMarkers}
      />
    );
  }

  return (
    <TimelineNativeRuler
      ticks={ticks}
      pxPerSec={pxPerSec}
      beatMarkers={beatMarkers}
    />
  );
};

export default React.memo(TimelineRuler);
