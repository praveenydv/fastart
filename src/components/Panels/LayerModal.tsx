import React, { useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";
import { FastArtProject, VideoClip, TextClip, CaptionClip, StickerClip } from "../../types/project";
import { soundEngine } from "../../utils/audioEngine";
import { triggerHaptic } from "../../utils/haptics";
import { MAX_TRACKS } from "../Timeline/timelineTypes";

interface LayerModalProps {
  visible: boolean;
  onClose: () => void;
  isInline?: boolean;
  project: FastArtProject | null;
  selectedClipId: string | null;
  selectedClipType?: string | null;
  currentTime?: number;
  onSelectClip?: (id: string, type: "video" | "photo" | "audio" | "text" | "sticker" | "effects" | "caption") => void;
  onUpdateProject?: (updatedProject: FastArtProject) => void;
}

interface ActiveLayerItem {
  id: string;
  type: "video" | "photo" | "text" | "sticker" | "caption";
  title: string;
  trackIndex: number;
  layer: number;
  effectiveZ: number;
  isSelected: boolean;
  hasCutout?: boolean;
}

export default function LayerModal({
  visible,
  onClose,
  isInline = false,
  project,
  selectedClipId,
  currentTime = 0,
  onSelectClip,
  onUpdateProject,
}: LayerModalProps) {
  if (!visible || !project) return null;

  const curTime = typeof currentTime === "number" ? currentTime : 0;

  // Collect all active visual clips at current playhead
  const activeLayers: ActiveLayerItem[] = useMemo(() => {
    const items: ActiveLayerItem[] = [];

    // 1. Video & Photo clips
    (project.tracks.video || []).forEach((c, idx) => {
      const isInside = curTime >= c.startTime && curTime <= c.startTime + c.duration;
      if (isInside || c.id === selectedClipId) {
        const trk = typeof c.trackIndex === "number" ? c.trackIndex : 0;
        const lyr = typeof c.layer === "number" && c.layer > 0 ? c.layer : trk + 1;
        const effectiveZ = lyr * 1000 + trk * 10;
        items.push({
          id: c.id,
          type: (c as any).type === "photo" ? "photo" : "video",
          title: c.title || (c as any).name || `Video Clip ${idx + 1}`,
          trackIndex: trk,
          layer: lyr,
          effectiveZ,
          isSelected: c.id === selectedClipId,
          hasCutout: !!c.cutout?.enabled,
        });
      }
    });

    // 2. Text clips
    (project.tracks.text || []).forEach((t, idx) => {
      const isInside = curTime >= t.startTime && curTime <= t.startTime + t.duration;
      if (isInside || t.id === selectedClipId) {
        const trk = typeof t.trackIndex === "number" ? t.trackIndex : 2;
        const lyr = typeof t.layer === "number" && t.layer > 0 ? t.layer : trk + 1;
        const effectiveZ = lyr * 1000 + trk * 10 + 3;
        items.push({
          id: t.id,
          type: "text",
          title: t.text ? `"${t.text.slice(0, 18)}${t.text.length > 18 ? "..." : ""}"` : `Text ${idx + 1}`,
          trackIndex: trk,
          layer: lyr,
          effectiveZ,
          isSelected: t.id === selectedClipId,
        });
      }
    });

    // 3. Captions
    (project.tracks.captions || []).forEach((cap, idx) => {
      const isInside = curTime >= cap.startTime && curTime <= cap.startTime + cap.duration;
      if (isInside || cap.id === selectedClipId) {
        const trk = typeof cap.trackIndex === "number" ? cap.trackIndex : 2;
        const lyr = typeof cap.layer === "number" && cap.layer > 0 ? cap.layer : trk + 1;
        const effectiveZ = lyr * 1000 + trk * 10 + 2;
        items.push({
          id: cap.id,
          type: "caption",
          title: cap.text ? `Caption: "${cap.text.slice(0, 15)}..."` : `Caption ${idx + 1}`,
          trackIndex: trk,
          layer: lyr,
          effectiveZ,
          isSelected: cap.id === selectedClipId,
        });
      }
    });

    // 4. Stickers
    (project.tracks.stickers || []).forEach((s, idx) => {
      const isInside = curTime >= s.startTime && curTime <= s.startTime + s.duration;
      if (isInside || s.id === selectedClipId) {
        const trk = typeof s.trackIndex === "number" ? s.trackIndex : 3;
        const lyr = typeof s.layer === "number" && s.layer > 0 ? s.layer : trk + 1;
        const effectiveZ = lyr * 1000 + trk * 10 + 4;
        items.push({
          id: s.id,
          type: "sticker",
          title: s.char || `Sticker ${idx + 1}`,
          trackIndex: trk,
          layer: lyr,
          effectiveZ,
          isSelected: s.id === selectedClipId,
        });
      }
    });

    // Sort from Topmost (front) to Bottom-most (back)
    return items.sort((a, b) => b.effectiveZ - a.effectiveZ);
  }, [project, curTime, selectedClipId]);

  const selectedLayerItem = activeLayers.find((item) => item.isSelected);

  const applyNewLayer = (targetLayer: number) => {
    if (!selectedClipId || !onUpdateProject) return;
    soundEngine.playSfx("click");
    triggerHaptic("selection");

    const clampedLayer = Math.max(1, Math.min(20, targetLayer));

    // Update the clip's layer & trackIndex across project tracks
    const updateClip = (c: any) => {
      if (c.id === selectedClipId) {
        return {
          ...c,
          layer: clampedLayer,
          trackIndex: Math.min(MAX_TRACKS - 1, Math.max(0, clampedLayer - 1)),
        };
      }
      return c;
    };

    const updatedTracks: any = {
      video: (project.tracks.video || []).map(updateClip),
      audio: project.tracks.audio || [],
      captions: (project.tracks.captions || []).map(updateClip),
      text: (project.tracks.text || []).map(updateClip),
      stickers: (project.tracks.stickers || []).map(updateClip),
      effects: (project.tracks.effects || []).map(updateClip),
      filters: project.tracks.filters || [],
    };

    onUpdateProject({
      ...project,
      tracks: updatedTracks,
    });
  };

  const handleBringToFront = () => {
    if (activeLayers.length === 0) return;
    const maxLayer = Math.max(...activeLayers.map((l) => l.layer), 1);
    applyNewLayer(maxLayer + 1);
  };

  const handleBringForward = () => {
    const curLyr = selectedLayerItem ? selectedLayerItem.layer : 1;
    applyNewLayer(curLyr + 1);
  };

  const handleSendBackward = () => {
    const curLyr = selectedLayerItem ? selectedLayerItem.layer : 2;
    applyNewLayer(Math.max(1, curLyr - 1));
  };

  const handleSendToBack = () => {
    applyNewLayer(1);
  };

  return (
    <View style={s.container}>
      {/* Header */}
      {!isInline && (
        <View style={s.header}>
          <View style={s.headerTitleRow}>
            <Ionicons name="layers-outline" size={18} color="#00F2FE" />
            <Text style={s.headerTitle}>Layer Order</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Selected Clip Layer Info Banner */}
        <View style={s.infoBanner}>
          <View style={s.infoBadge}>
            <Text style={s.infoBadgeText}>
              Layer {selectedLayerItem ? selectedLayerItem.layer : 1}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.infoTitle} numberOfLines={1}>
              {selectedLayerItem ? selectedLayerItem.title : "Select a clip to adjust layer"}
            </Text>
            <Text style={s.infoSubtitle}>
              {selectedLayerItem
                ? `Track ${selectedLayerItem.trackIndex + 1} • Higher layers render on top`
                : "Higher numbered layers visually overlay lower numbered layers"}
            </Text>
          </View>
        </View>

        {/* Quick Stacking Actions */}
        <Text style={s.sectionTitle}>REORDER ACTIONS</Text>
        <View style={s.actionGrid}>
          <TouchableOpacity
            style={[s.actionBtn, !selectedLayerItem && s.actionBtnDisabled]}
            disabled={!selectedLayerItem}
            onPress={handleBringToFront}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="format-vertical-align-top" size={16} color="#00F2FE" />
            <Text style={s.actionBtnText}>Bring to Front</Text>
            <Text style={s.actionBtnSub}>Topmost</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionBtn, !selectedLayerItem && s.actionBtnDisabled]}
            disabled={!selectedLayerItem}
            onPress={handleBringForward}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-up" size={16} color="#38BDF8" />
            <Text style={s.actionBtnText}>Bring Forward</Text>
            <Text style={s.actionBtnSub}>+1 Layer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionBtn, !selectedLayerItem && s.actionBtnDisabled]}
            disabled={!selectedLayerItem}
            onPress={handleSendBackward}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-down" size={16} color="#A78BFA" />
            <Text style={s.actionBtnText}>Send Backward</Text>
            <Text style={s.actionBtnSub}>-1 Layer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.actionBtn, !selectedLayerItem && s.actionBtnDisabled]}
            disabled={!selectedLayerItem}
            onPress={handleSendToBack}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="format-vertical-align-bottom" size={16} color="#F43F5E" />
            <Text style={s.actionBtnText}>Send to Back</Text>
            <Text style={s.actionBtnSub}>Background</Text>
          </TouchableOpacity>
        </View>

        {/* Numeric Layer Selector Presets */}
        <Text style={s.sectionTitle}>DIRECT LAYER PRESET</Text>
        <View style={s.layerPresetsRow}>
          {[1, 2, 3, 4, 5, 6].map((num) => {
            const isActive = selectedLayerItem?.layer === num;
            return (
              <TouchableOpacity
                key={`lyr-preset-${num}`}
                style={[s.presetChip, isActive && s.presetChipActive]}
                onPress={() => applyNewLayer(num)}
                disabled={!selectedLayerItem}
                activeOpacity={0.75}
              >
                <Text style={[s.presetChipText, isActive && s.presetChipTextActive]}>
                  {num === 1 ? "1 (Main)" : `L${num}`}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Visual Layer Stack Overview at Current Playhead */}
        <Text style={s.sectionTitle}>CURRENT VISUAL STACK (TOP TO BOTTOM)</Text>
        <View style={s.stackList}>
          {activeLayers.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="layers-outline" size={24} color="#475569" />
              <Text style={s.emptyStateText}>No visual clips at playhead</Text>
            </View>
          ) : (
            activeLayers.map((item, index) => {
              const isSelected = item.isSelected;
              const isTop = index === 0;
              const isBottom = index === activeLayers.length - 1;

              return (
                <TouchableOpacity
                  key={`stack-item-${item.id}`}
                  style={[s.stackItem, isSelected && s.stackItemActive]}
                  onPress={() => onSelectClip?.(item.id, item.type)}
                  activeOpacity={0.8}
                >
                  <View style={[s.layerNumberBadge, isSelected && s.layerNumberBadgeActive]}>
                    <Text style={[s.layerNumberText, isSelected && s.layerNumberTextActive]}>
                      L{item.layer}
                    </Text>
                  </View>

                  <View style={s.stackItemIconBox}>
                    {item.type === "video" && (
                      <Ionicons name="videocam-outline" size={13} color={item.hasCutout ? "#00F2FE" : "#38BDF8"} />
                    )}
                    {item.type === "photo" && <Ionicons name="image-outline" size={13} color="#38BDF8" />}
                    {item.type === "text" && <MaterialCommunityIcons name="format-text" size={13} color="#FBBF24" />}
                    {item.type === "caption" && <Ionicons name="chatbox-ellipses-outline" size={13} color="#A78BFA" />}
                    {item.type === "sticker" && <Ionicons name="happy-outline" size={13} color="#34D399" />}
                  </View>

                  <View style={s.stackItemDetails}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                      <Text style={[s.stackItemTitle, isSelected && s.stackItemTitleActive]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {item.hasCutout && (
                        <View style={s.cutoutPill}>
                          <Text style={s.cutoutPillText}>CUTOUT</Text>
                        </View>
                      )}
                    </View>
                    <Text style={s.stackItemSub}>
                      Track {item.trackIndex + 1} {isTop ? "• (Top Front)" : isBottom ? "• (Background)" : ""}
                    </Text>
                  </View>

                  {isSelected ? (
                    <View style={s.activeCheck}>
                      <Ionicons name="checkmark-circle" size={14} color="#00F2FE" />
                    </View>
                  ) : (
                    <Ionicons name="chevron-forward" size={13} color="#475569" />
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E17",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#1A2234",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "500",
    letterSpacing: 0.2,
  },
  closeBtn: {
    padding: 3,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 8,
    paddingBottom: 24,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131927",
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1E293B",
    marginBottom: 8,
  },
  infoBadge: {
    backgroundColor: "#00F2FE20",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#00F2FE60",
  },
  infoBadgeText: {
    color: "#00F2FE",
    fontSize: 10.5,
    fontWeight: "500",
  },
  infoTitle: {
    color: "#FFFFFF",
    fontSize: 10.5,
    fontWeight: "500",
  },
  infoSubtitle: {
    color: "#94A3B8",
    fontSize: 8.5,
    marginTop: 1,
  },
  sectionTitle: {
    color: "#64748B",
    fontSize: 8.5,
    fontWeight: "500",
    letterSpacing: 0.6,
    marginBottom: 4,
    marginTop: 3,
  },
  actionGrid: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 8,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: "#131927",
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  actionBtnDisabled: {
    opacity: 0.35,
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "400",
    marginTop: 2,
    textAlign: "center",
  },
  actionBtnSub: {
    color: "#64748B",
    fontSize: 7.5,
    marginTop: 1,
    fontWeight: "400",
  },
  layerPresetsRow: {
    flexDirection: "row",
    gap: 5,
    marginBottom: 8,
  },
  presetChip: {
    flex: 1,
    backgroundColor: "#131927",
    paddingVertical: 5,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#1E293B",
  },
  presetChipActive: {
    backgroundColor: "#00F2FE18",
    borderColor: "#00F2FE",
  },
  presetChipText: {
    color: "#94A3B8",
    fontSize: 9.5,
    fontWeight: "400",
  },
  presetChipTextActive: {
    color: "#00F2FE",
    fontWeight: "500",
  },
  stackList: {
    backgroundColor: "#131927",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#1E293B",
    overflow: "hidden",
  },
  emptyState: {
    padding: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  emptyStateText: {
    color: "#64748B",
    fontSize: 9.5,
    fontWeight: "400",
  },
  stackItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1A2333",
  },
  stackItemActive: {
    backgroundColor: "#00F2FE10",
  },
  layerNumberBadge: {
    width: 24,
    height: 18,
    backgroundColor: "#1E293B",
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  layerNumberBadgeActive: {
    backgroundColor: "#00F2FE30",
    borderWidth: 1,
    borderColor: "#00F2FE",
  },
  layerNumberText: {
    color: "#94A3B8",
    fontSize: 8.5,
    fontWeight: "500",
  },
  layerNumberTextActive: {
    color: "#00F2FE",
  },
  stackItemIconBox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: "#0F131D",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  stackItemDetails: {
    flex: 1,
  },
  stackItemTitle: {
    color: "#E2E8F0",
    fontSize: 10.5,
    fontWeight: "400",
  },
  stackItemTitleActive: {
    color: "#00F2FE",
    fontWeight: "500",
  },
  stackItemSub: {
    color: "#64748B",
    fontSize: 8.5,
    marginTop: 1,
  },
  cutoutPill: {
    backgroundColor: "#00F2FE25",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: "#00F2FE80",
  },
  cutoutPillText: {
    color: "#00F2FE",
    fontSize: 7.5,
    fontWeight: "500",
  },
  activeCheck: {
    marginLeft: 6,
  },
});

