import React, { useMemo } from "react";
import { View, Text } from "react-native";
import { styles } from "./TimelineStyles";

interface TimelineRulerProps {
  rulerRef: any;
  rulerPanResponder: any;
  ticks: { time: number; label: string; isMajor: boolean }[];
  pxPerSec: number;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  rulerRef,
  rulerPanResponder,
  ticks,
  pxPerSec,
}) => {
  const renderedTicks = useMemo(() => {
    return ticks.map((tk, i) => (
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
    ));
  }, [ticks, pxPerSec]);

  return (
    <View
      ref={rulerRef}
      style={styles.rulerContainer}
      {...rulerPanResponder.panHandlers}
    >
      {renderedTicks}
    </View>
  );
};

export default React.memo(TimelineRuler);
