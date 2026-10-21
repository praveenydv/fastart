import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import FastArtLogo from "./FastArtLogo";
import { soundEngine } from "../utils/audioEngine";
import ConfirmDeleteModal from "./ConfirmDeleteModal";

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

function formatPlayheadTime(sec = 0) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms}`;
}

function formatDuration(sec = 0) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export default function HomeDashboard({
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
          <View style={styles.proBadge}>
            <Text style={styles.proText}>PRO</Text>
          </View>
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
              <Text style={styles.resumeTimestamp}>
                at {formatPlayheadTime(lastSession?.currentTime || 0)}
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
          {/* <View style={styles.newProjectArrowBtn}>
            <Ionicons name="arrow-forward" size={16} color="#00F2FE" />
          </View> */}
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
          projects.map((proj) => {
            const videoClips = proj.tracks?.video || [];
            const numClips = videoClips.length;
            const thumbUrl = videoClips[0]?.thumbnail;

            return (
              <TouchableOpacity
                key={proj.id}
                style={styles.projectCard}
                onPress={() => {
                  soundEngine.playSfx("click");
                  onOpenProject(proj.id);
                }}
                activeOpacity={0.75}
              >
                {/* Clean Thumbnail */}
                <View style={styles.projectThumb}>
                  {thumbUrl ? (
                    <Image
                      source={{ uri: thumbUrl }}
                      style={styles.thumbImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="film" size={20} color="#00F2FE" />
                  )}
                  <View style={styles.aspectBadge}>
                    <Text style={styles.aspectBadgeText}>
                      {proj.aspectRatio || "9:16"}
                    </Text>
                  </View>
                </View>

                {/* Info Column */}
                <View style={styles.projectInfoCol}>
                  <Text style={styles.projectTitle} numberOfLines={1}>
                    {proj.title}
                  </Text>
                  <Text style={styles.projectMeta} numberOfLines={1}>
                    {numClips} {numClips === 1 ? "clip" : "clips"} •{" "}
                    {proj.resolution || "1080p"} • {proj.fps || 30}fps
                  </Text>
                </View>

                {/* Minimalist Options Button (replaces 3 cluttered buttons) */}
                <TouchableOpacity
                  style={styles.optionsBtn}
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    soundEngine.playSfx("click");
                    setOptionsProject(proj);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel="Project options"
                >
                  <Ionicons
                    name="ellipsis-horizontal"
                    size={18}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Project Options Bottom Sheet Modal */}
      <Modal
        visible={!!optionsProject}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionsProject(null)}
      >
        <TouchableOpacity
          style={styles.sheetOverlay}
          activeOpacity={1}
          onPress={() => setOptionsProject(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheetContainer}>
            {/* Sheet Handle */}
            <View style={styles.sheetHandle} />

            {/* Project Header Info */}
            <View style={styles.sheetHeader}>
              <View style={styles.sheetThumb}>
                <Ionicons name="film" size={18} color="#00F2FE" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetProjectTitle} numberOfLines={1}>
                  {optionsProject?.title}
                </Text>
                <Text style={styles.sheetProjectMeta}>
                  {optionsProject?.aspectRatio} •{" "}
                  {optionsProject?.resolution || "1080p"} •{" "}
                  {optionsProject?.tracks?.video?.length || 0} clips
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.sheetActionsList}>
              <TouchableOpacity
                style={styles.sheetActionItem}
                onPress={() => {
                  if (optionsProject) {
                    soundEngine.playSfx("whoosh");
                    onOpenProject(optionsProject.id);
                    setOptionsProject(null);
                  }
                }}
              >
                <View
                  style={[
                    styles.actionIconBox,
                    { backgroundColor: "rgba(0, 242, 254, 0.12)" },
                  ]}
                >
                  <Ionicons name="play" size={17} color="#00F2FE" />
                </View>
                <Text
                  style={[
                    styles.sheetActionText,
                    { color: "#00F2FE", fontWeight: "700" },
                  ]}
                >
                  Open in Editor
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetActionItem}
                onPress={() => {
                  if (optionsProject) {
                    handleOpenRename(optionsProject.id, optionsProject.title);
                  }
                }}
              >
                <View style={styles.actionIconBox}>
                  <Ionicons name="pencil-outline" size={17} color="#94A3B8" />
                </View>
                <Text style={styles.sheetActionText}>Rename Project</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetActionItem}
                onPress={() => {
                  if (optionsProject) {
                    soundEngine.playSfx("pop");
                    onDuplicateProject(optionsProject.id);
                    setOptionsProject(null);
                  }
                }}
              >
                <View style={styles.actionIconBox}>
                  <Ionicons name="copy-outline" size={17} color="#94A3B8" />
                </View>
                <Text style={styles.sheetActionText}>Duplicate Project</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sheetActionItem, styles.sheetActionItemDanger]}
                onPress={() => {
                  if (optionsProject) {
                    soundEngine.playSfx("click");
                    setProjectToDelete(optionsProject);
                    setOptionsProject(null);
                  }
                }}
              >
                <View
                  style={[
                    styles.actionIconBox,
                    { backgroundColor: "rgba(255, 0, 80, 0.12)" },
                  ]}
                >
                  <Ionicons name="trash-outline" size={17} color="#FF0050" />
                </View>
                <Text style={[styles.sheetActionText, { color: "#FF0050" }]}>
                  Delete Project
                </Text>
              </TouchableOpacity>
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.sheetCancelBtn}
              onPress={() => setOptionsProject(null)}
            >
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Rename Project Modal */}
      <Modal
        visible={!!renamingProject}
        transparent
        animationType="fade"
        onRequestClose={() => setRenamingProject(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setRenamingProject(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderIcon}>
                <Ionicons name="create-outline" size={18} color="#00F2FE" />
              </View>
              <Text style={styles.modalTitle}>Rename Project</Text>
            </View>

            <TextInput
              style={styles.titleInput}
              value={newTitleText}
              onChangeText={setNewTitleText}
              placeholder="Project title..."
              placeholderTextColor="#64748B"
              autoFocus
              selectTextOnFocus
              maxLength={40}
              onSubmitEditing={handleSaveRename}
            />

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  soundEngine.playSfx("click");
                  setRenamingProject(null);
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  !newTitleText.trim() && styles.saveBtnDisabled,
                ]}
                disabled={!newTitleText.trim()}
                onPress={handleSaveRename}
              >
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0D13",
  },
  navBar: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  proBadge: {
    backgroundColor: "#FFE600",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  proText: {
    color: "#000000",
    fontSize: 9,
    fontWeight: "900",
  },
  navActions: {
    flexDirection: "row",
    gap: 8,
  },
  navIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#131722",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#FF0050",
    minWidth: 15,
    height: 15,
    borderRadius: 7.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    borderWidth: 1.5,
    borderColor: "#0B0D13",
  },
  bellBadgeText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  // Slim, elegant Resume Banner
  resumeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 242, 254, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.22)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  resumePlayIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  resumeTextContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    overflow: "hidden",
  },
  resumeLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
    flexShrink: 1,
  },
  resumeProjectName: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  resumeTimestamp: {
    color: "#00F2FE",
    fontSize: 11,
    fontWeight: "700",
  },
  // Sleek, compact Horizontal New Project Card
  newProjectHero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131722",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  newProjectIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  newProjectTextCol: {
    flex: 1,
  },
  newProjectTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  newProjectSubtitle: {
    color: "#8E95A5",
    fontSize: 12,
    marginTop: 2,
  },
  newProjectArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 242, 254, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  // Section Header
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  countPill: {
    backgroundColor: "#1E2538",
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: 10,
  },
  countPillText: {
    color: "#00F2FE",
    fontSize: 10,
    fontWeight: "800",
  },
  // Project Card
  projectCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131722",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  projectThumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#1A2030",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  aspectBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 3,
    paddingVertical: 0.5,
    borderRadius: 3,
  },
  aspectBadgeText: {
    color: "#00F2FE",
    fontSize: 7.5,
    fontWeight: "800",
  },
  projectInfoCol: {
    flex: 1,
    marginLeft: 12,
    marginRight: 6,
  },
  projectTitle: {
    color: "#FFFFFF",
    fontSize: 14.5,
    fontWeight: "700",
  },
  projectMeta: {
    color: "#8E95A5",
    fontSize: 11,
    marginTop: 2.5,
  },
  optionsBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  // Empty State
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#141824",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  emptySubtitle: {
    color: "#64748B",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 16,
  },
  // Project Options Sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#141721",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#334155",
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 14,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  sheetThumb: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: "#1E2538",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sheetProjectTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  sheetProjectMeta: {
    color: "#8E95A5",
    fontSize: 11,
    marginTop: 2,
  },
  sheetActionsList: {
    gap: 4,
  },
  sheetActionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  sheetActionItemDanger: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.04)",
  },
  actionIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1E2538",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  sheetActionText: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "600",
  },
  sheetCancelBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#1E2538",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCancelText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "700",
  },
  // Rename Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#141721",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  modalHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  titleInput: {
    backgroundColor: "#0B0D13",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#00F2FE",
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 18,
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#1E2538",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "700",
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "800",
  },
});
