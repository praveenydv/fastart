import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FastArtLogo from "./FastArtLogo";
import { soundEngine } from "../utils/audioEngine";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import { styles } from "./HomeDashboard/HomeDashboardStyles";
import { ProjectCardItem } from "./HomeDashboard/ProjectCardItem";
import { ProjectOptionsMenu } from "./HomeDashboard/ProjectOptionsMenu";
import { RenameProjectModal } from "./HomeDashboard/RenameProjectModal";
import { formatPlayheadTime } from "./Timeline/timelineUtils";

interface HomeDashboardProps {
  projects: any[];
  onOpenProject: (id: string) => void;
  onCreateNewProject: () => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
  onRenameProject?: (id: string, newTitle: string) => void;
  onOpenSettings: () => void;
  onOpenNotifications: () => void;
  unreadNotificationsCount?: number;
  lastSession?: any;
}

function formatDuration(sec = 0) {
  return formatPlayheadTime(sec);
}

function HomeDashboard({
  projects,
  onOpenProject,
  onCreateNewProject,
  onDuplicateProject,
  onDeleteProject,
  onRenameProject,
  onOpenSettings,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  lastSession,
}: HomeDashboardProps) {
  const [optionsProject, setOptionsProject] = useState<any | null>(null);
  const [renamingProject, setRenamingProject] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [newTitleText, setNewTitleText] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<any | null>(null);

  const handleOpenRename = (id: string, currentTitle: string) => {
    setRenamingProject({ id, title: currentTitle });
    setNewTitleText(currentTitle);
    setOptionsProject(null);
  };

  const handleSaveRename = () => {
    const trimmed = newTitleText.trim();
    if (renamingProject && trimmed && onRenameProject) {
      soundEngine.playSfx("pop");
      onRenameProject(renamingProject.id, trimmed);
    }
    setRenamingProject(null);
  };

  const lastProject = lastSession
    ? projects.find((p) => p.id === lastSession.projectId)
    : null;

  return (
    <View style={styles.container}>
      {/* Top Navbar */}
      <View style={styles.navBar}>
        <View style={styles.logoRow}>
          <FastArtLogo size={30} />
          <Text style={styles.logoText}>FastArt</Text>
        </View>

        <View style={styles.navActions}>
          <TouchableOpacity
            style={styles.navIconBtn}
            activeOpacity={0.7}
            onPress={() => {
              soundEngine.playSfx("click");
              onOpenNotifications();
            }}
          >
            <Ionicons name="notifications-outline" size={19} color="#94A3B8" />
            {unreadNotificationsCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadNotificationsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navIconBtn}
            activeOpacity={0.7}
            onPress={() => {
              soundEngine.playSfx("click");
              onOpenSettings();
            }}
          >
            <Ionicons name="settings-outline" size={19} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Compact "Resume Last Edit" Banner */}
        {lastProject && (
          <TouchableOpacity
            style={styles.resumeBanner}
            onPress={() => {
              soundEngine.playSfx("whoosh");
              onOpenProject(lastProject.id);
            }}
            activeOpacity={0.8}
          >
            <View style={styles.resumePlayIcon}>
              <Ionicons name="play" size={13} color="#000000" />
            </View>
            <View style={styles.resumeTextContainer}>
              <Text style={styles.resumeLabel} numberOfLines={1}>
                Resume:{" "}
                <Text style={styles.resumeProjectName}>
                  {lastProject.title}
                </Text>
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#00F2FE" />
          </TouchableOpacity>
        )}

        {/* Sleek Horizontal "+ New Project" Action Hero */}
        <TouchableOpacity
          style={styles.newProjectHero}
          onPress={() => {
            soundEngine.playSfx("whoosh");
            onCreateNewProject();
          }}
          activeOpacity={0.85}
        >
          <View style={styles.newProjectIconBox}>
            <Ionicons name="add" size={24} color="#000000" />
          </View>
          <View style={styles.newProjectTextCol}>
            <Text style={styles.newProjectTitle}>New Project</Text>
            <Text style={styles.newProjectSubtitle}>
              Start creating with video, photos & music
            </Text>
          </View>
        </TouchableOpacity>

        {/* Recent Projects Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Recent Projects</Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{projects.length}</Text>
          </View>
        </View>

        {/* Projects List or Clean Empty State */}
        {projects.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="film-outline" size={28} color="#475569" />
            </View>
            <Text style={styles.emptyTitle}>No Projects Yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap New Project above to start your first video edit.
            </Text>
          </View>
        ) : (
          projects.map((proj) => (
            <ProjectCardItem
              key={proj.id}
              project={proj}
              onOpenProject={onOpenProject}
              onOptionsPress={setOptionsProject}
            />
          ))
        )}
      </ScrollView>

      {/* Project Options Bottom Sheet Modal */}
      <ProjectOptionsMenu
        optionsProject={optionsProject}
        onClose={() => setOptionsProject(null)}
        onOpenProject={onOpenProject}
        onOpenRename={handleOpenRename}
        onDuplicateProject={onDuplicateProject}
        onSelectDelete={setProjectToDelete}
      />

      {/* Rename Project Modal */}
      <RenameProjectModal
        renamingProject={renamingProject}
        newTitleText={newTitleText}
        setNewTitleText={setNewTitleText}
        onClose={() => setRenamingProject(null)}
        onSave={handleSaveRename}
      />

      {/* Delete Project Confirmation Modal */}
      <ConfirmDeleteModal
        visible={!!projectToDelete}
        title="Delete Project?"
        message="Are you sure you want to delete this project? This will permanently delete the project and all timeline clips."
        itemName={projectToDelete?.title}
        itemType="Project"
        itemDetails={
          projectToDelete
            ? `${projectToDelete.aspectRatio || "9:16"} • ${projectToDelete.resolution || "1080p"} • ${formatDuration(projectToDelete.duration || 0)}`
            : undefined
        }
        confirmText="Delete Project"
        cancelText="Cancel"
        onConfirm={() => {
          if (projectToDelete) {
            onDeleteProject(projectToDelete.id);
            setProjectToDelete(null);
          }
        }}
        onCancel={() => setProjectToDelete(null)}
      />
    </View>
  );
}

export default React.memo(HomeDashboard);
