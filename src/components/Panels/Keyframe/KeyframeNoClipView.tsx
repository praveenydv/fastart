import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { soundEngine } from "../../../utils/audioEngine";
import { noClipStyles } from "./KeyframeNoClipStyles";

interface KeyframeNoClipViewProps {
  onClose: () => void;
}

export default function KeyframeNoClipView({ onClose }: KeyframeNoClipViewProps) {
  return (
    <View style={noClipStyles.noClipContainer}>
      <View style={noClipStyles.noClipIconBox}>
        <Ionicons name="diamond-outline" size={56} color="#FFE600" />
      </View>
      <Text style={noClipStyles.noClipTitle}>No Clip Selected</Text>
      <Text style={noClipStyles.noClipDesc}>
        Select any video, photo, text, or sticker on your timeline to
        animate its position, scale, rotation, and opacity smoothly
        across time.
      </Text>

      {/* Tutorial Step Cards */}
      <View style={noClipStyles.stepsList}>
        <View style={noClipStyles.stepItem}>
          <View style={noClipStyles.stepNumber}>
            <Text style={noClipStyles.stepNumberText}>1</Text>
          </View>
          <View style={noClipStyles.stepContent}>
            <Text style={noClipStyles.stepTitle}>Select a Timeline Clip</Text>
            <Text style={noClipStyles.stepText}>
              Tap a video, text, or sticker clip to activate it.
            </Text>
          </View>
        </View>

        <View style={noClipStyles.stepItem}>
          <View style={noClipStyles.stepNumber}>
            <Text style={noClipStyles.stepNumberText}>2</Text>
          </View>
          <View style={noClipStyles.stepContent}>
            <Text style={noClipStyles.stepTitle}>Position the Playhead</Text>
            <Text style={noClipStyles.stepText}>
              Scrub to the exact second where movement begins.
            </Text>
          </View>
        </View>

        <View style={noClipStyles.stepItem}>
          <View style={noClipStyles.stepNumber}>
            <Text style={noClipStyles.stepNumberText}>3</Text>
          </View>
          <View style={noClipStyles.stepContent}>
            <Text style={noClipStyles.stepTitle}>Drop Keyframes & Move</Text>
            <Text style={noClipStyles.stepText}>
              Tap the Diamond ⟐ button to save positions. FastArt
              interpolates smoothly between diamonds!
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={noClipStyles.gotItBtn}
        onPress={() => {
          soundEngine.playSfx("pop");
          onClose();
        }}
        activeOpacity={0.8}
      >
        <Text style={noClipStyles.gotItBtnText}>Select Clip on Timeline</Text>
        <Ionicons name="arrow-forward" size={16} color="#000000" />
      </TouchableOpacity>
    </View>
  );
}
