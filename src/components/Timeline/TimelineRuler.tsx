import React from "react";
import { View, Text } from "react-native";
import { styles } from "./TimelineStyles";

export interface TimelineRulerProps {
  width: number;
  height?: number;
  ticks: { time: number; label: string; isMajor: boolean }[];
  pxPerSec: number;
  beatMarkers?: number[];
}

const TimelineNativeRuler: React.FC<{
  ticks: { time: number; label: string; isMajor: boolean }[];
  pxPerSec: number;
  beatMarkers?: number[];
}> = React.memo(({ ticks, pxPerSec, beatMarkers }) => {
  return (
    <>
      {ticks.map((tk, i) => (
        <View
          key={`tick-${i}-${tk.time}`}
          style={[styles.tickWrapper, { left: Math.round(tk.time * pxPerSec) }]}
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
              left: Math.round(beatTime * pxPerSec) - 3,
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
  ticks,
  pxPerSec,
  beatMarkers,
}) => {
  return (
    <TimelineNativeRuler
      ticks={ticks}
      pxPerSec={pxPerSec}
      beatMarkers={beatMarkers}
    />
  );
};

export default React.memo(TimelineRuler);
