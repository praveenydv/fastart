import { StyleSheet } from "react-native";
import { canvasStyles } from "./PlayerCanvasStyles";
import { controlStyles } from "./PlayerControlStyles";
import { cropStyles } from "./PlayerCropStyles";

export const styles = StyleSheet.create({
  ...canvasStyles,
  ...controlStyles,
  ...cropStyles,
} as any);

export default styles;
