import { StyleSheet } from "react-native";
import { headerStyles } from "./TimelineHeaderStyles";
import { trackStyles } from "./TimelineTrackStyles";

export const styles = StyleSheet.create({
  ...headerStyles,
  ...trackStyles,
} as any);

export default styles;
