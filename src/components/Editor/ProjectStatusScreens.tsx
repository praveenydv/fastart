import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import ProjectNotFoundScreen from "../ProjectNotFoundScreen";
import { FastArtProject } from "../../types/project";

interface ProjectStatusScreensProps {
  screen: string;
  project: FastArtProject | null;
  projects: FastArtProject[];
  projectKey?: string;
  isAppLoading: boolean;
  onGoHome: () => void;
  onCreateNewProject: () => void;
  onOpenProject: (id: string) => void;
}

export const ProjectStatusScreens: React.FC<ProjectStatusScreensProps> = ({
  screen,
  project,
  projects,
  projectKey,
  isAppLoading,
  onGoHome,
  onCreateNewProject,
  onOpenProject,
}) => {
  // 1. Loading placeholder while project hydrates
  if (
    screen === "editor" &&
    !project &&
    projects.some((p) => p.id === projectKey)
  ) {
    return (
      <View style={styles.projectLoadingSurface}>
        <ActivityIndicator size="large" color="#00F2FE" />
        <Text style={styles.projectLoadingText}>Opening project...</Text>
      </View>
    );
  }

  // 2. PROJECT NOT FOUND SCREEN
  if (
    !isAppLoading &&
    projects.length > 0 &&
    screen === "editor" &&
    projectKey &&
    !project &&
    !projects.some(
      (p) =>
        p.id === projectKey ||
        p.id.toLowerCase() === (projectKey || "").toLowerCase(),
    )
  ) {
    return (
      <ProjectNotFoundScreen
        projectKey={projectKey || ""}
        onGoHome={onGoHome}
        onCreateNew={onCreateNewProject}
        onOpenDefault={
          projects.length > 0
            ? () => onOpenProject(projects[0].id)
            : undefined
        }
      />
    );
  }

  return null;
};

const styles = StyleSheet.create({
  projectLoadingSurface: {
    flex: 1,
    backgroundColor: "#0B0D13",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  projectLoadingText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
  },
});
