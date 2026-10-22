import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./HomeDashboardStyles";
import { soundEngine } from "../../utils/audioEngine";

interface ProjectCardItemProps {
  project: any;
  onOpenProject: (id: string) => void;
  onOptionsPress: (proj: any) => void;
}

const ProjectCardItemComponent: React.FC<ProjectCardItemProps> = ({
  project,
  onOpenProject,
  onOptionsPress,
}) => {
  const videoClips = project.tracks?.video || [];
  const numClips = videoClips.length;
  const thumbUrl =
    project.thumbnailUrl ||
    videoClips[0]?.thumbnail ||
    videoClips[0]?.url;

  return (
    <TouchableOpacity
      style={styles.projectCard}
      onPress={() => {
        soundEngine.playSfx("click");
        onOpenProject(project.id);
      }}
      activeOpacity={0.75}
    >
      {/* Clean Thumbnail */}
      <View style={styles.projectThumb}>
        {thumbUrl ? (
          <Image
            source={{ uri: thumbUrl }}
            style={{ width: "100%", height: "100%", borderRadius: 6 }}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="film" size={20} color="#00F2FE" />
        )}
      </View>

      {/* Info Column */}
      <View style={styles.projectInfoCol}>
        <Text style={styles.projectTitle} numberOfLines={1}>
          {project.title}
        </Text>
        <Text style={styles.projectMeta} numberOfLines={1}>
          {numClips} {numClips === 1 ? "clip" : "clips"} •{" "}
          {project.aspectRatio || "9:16"}
        </Text>
      </View>

      {/* Minimalist Options Button */}
      <TouchableOpacity
        style={styles.optionsBtn}
        onPress={(e: any) => {
          e?.stopPropagation?.();
          soundEngine.playSfx("click");
          onOptionsPress(project);
        }}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityLabel="Project options"
      >
        <Ionicons name="ellipsis-horizontal" size={18} color="#94A3B8" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

export const ProjectCardItem = React.memo(ProjectCardItemComponent);
export default ProjectCardItem;
