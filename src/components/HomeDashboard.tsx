import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
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
  const [renamingProject, setRenamingProject] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [newTitleText, setNewTitleText] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<any | null>(null);

  const handleOpenRename = (id: string, currentTitle: string) => {
    setRenamingProject({ id, title: currentTitle });
    setNewTitleText(currentTitle);
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
          <FastArtLogo size={34} />
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
            <Ionicons name="notifications-outline" size={20} color="#8E95A5" />
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
            <Ionicons name="settings-outline" size={20} color="#8E95A5" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollArea}>
        {/* "Resume Last Edit" Hero Card if available */}
        {lastProject && (
          <TouchableOpacity
            style={styles.resumeCard}
            onPress={() => {
              soundEngine.playSfx("whoosh");
              onOpenProject(lastProject.id);
            }}
            activeOpacity={0.85}
          >
            <View style={styles.resumeLeft}>
              <View style={styles.resumePlayCircle}>
                <Ionicons name="play" size={20} color="#000000" />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <View style={styles.resumeTagRow}>
                  <View style={styles.resumeTag}>
                    <Text style={styles.resumeTagText}>RESUME LAST EDIT</Text>
                  </View>
                  <Text style={styles.resumeTimeText}>
                    At {formatPlayheadTime(lastSession?.currentTime || 0)}
                  </Text>
                </View>
                <Text style={styles.resumeTitle} numberOfLines={1}>
                  {lastProject.title}
                </Text>
                <Text style={styles.resumeMeta}>
                  {lastProject.tracks?.video?.length || 0} clips • {lastProject.aspectRatio} • {lastProject.resolution || "1080p"}
                </Text>
              </View>
            </View>
            <View style={styles.resumeBtn}>
              <Text style={styles.resumeBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={14} color="#000000" />
            </View>
          </TouchableOpacity>
        )}

        {/* "+ New Project" Hero Card */}
        <TouchableOpacity
          style={styles.newProjectCard}
          onPress={() => {
            soundEngine.playSfx("whoosh");
            onCreateNewProject();
          }}
          activeOpacity={0.85}
        >
          <View style={styles.newProjectPlusCircle}>
            <Ionicons name="add" size={32} color="#000000" />
          </View>
          <Text style={styles.newProjectTitle}>New Project</Text>
          <Text style={styles.newProjectSubtext}>
            Start creating with videos, photos, and music
          </Text>
        </TouchableOpacity>

        {/* Recent Projects List */}
        <View style={styles.projectsHeaderRow}>
          <Text style={styles.sectionHeader}>
            RECENT PROJECTS ({projects.length})
          </Text>
        </View>

        {projects.map((proj) => {
          const videoClips = proj.tracks?.video || [];
          const numClips = videoClips.length;
          return (
            <TouchableOpacity
              key={proj.id}
              style={styles.projectCard}
              onPress={() => {
                soundEngine.playSfx("click");
                onOpenProject(proj.id);
              }}
              activeOpacity={0.8}
            >
              {/* Thumbnail representation */}
              <View style={styles.projectThumb}>
                <Ionicons name="film" size={24} color="#00F2FE" />
                <View style={styles.thumbDurationBadge}>
                  <Text style={styles.thumbDurationText}>
                    {proj.aspectRatio}
                  </Text>
                </View>
              </View>

              <View style={{ flex: 1, marginLeft: 14 }}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Text style={styles.projectTitle} numberOfLines={1}>
                    {proj.title}
                  </Text>
                  {/* <TouchableOpacity
                    style={styles.inlineRenameBtn}
                    onPress={(e: any) => {
                      e?.stopPropagation?.();
                      soundEngine.playSfx('click');
                      handleOpenRename(proj.id, proj.title);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="pencil" size={12} color="#00F2FE" />
                  </TouchableOpacity> */}
                </View>
                <Text style={styles.projectMeta}>
                  {numClips} clips • {proj.resolution || "1080p"} • Updated
                  today
                </Text>
              </View>

              {/* Action Buttons: Rename, Duplicate & Delete */}
              <View style={styles.projectActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnRename]}
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    soundEngine.playSfx("click");
                    handleOpenRename(proj.id, proj.title);
                  }}
                  accessibilityLabel="Rename Project"
                >
                  <Ionicons name="pencil-outline" size={15} color="#00F2FE" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    soundEngine.playSfx("pop");
                    onDuplicateProject(proj.id);
                  }}
                  accessibilityLabel="Duplicate Project"
                >
                  <Ionicons name="copy-outline" size={15} color="#8E95A5" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    soundEngine.playSfx("pop");
                    setProjectToDelete(proj);
                  }}
                  accessibilityLabel="Delete Project"
                >
                  <Ionicons name="trash-outline" size={15} color="#FF0050" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
                <Ionicons name="create-outline" size={20} color="#00F2FE" />
              </View>
              <Text style={styles.modalTitle}>Rename Project</Text>
            </View>

            <Text style={styles.modalSubtitle}>
              Give your video project a custom title
            </Text>

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
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#1A1E29",
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  proBadge: {
    backgroundColor: "#FFE600",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proText: {
    color: "#000000",
    fontSize: 10,
    fontWeight: "900",
  },
  navActions: {
    flexDirection: "row",
    gap: 8,
  },
  navIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#141721",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#FF0050",
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#0B0D13",
  },
  bellBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "900",
  },
  scrollArea: {
    flex: 1,
    padding: 16,
  },
  newProjectCard: {
    backgroundColor: "#141721",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#252B3B",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  newProjectPlusCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  newProjectTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  newProjectSubtext: {
    color: "#8E95A5",
    fontSize: 12,
    marginTop: 4,
  },
  projectsHeaderRow: {
    marginBottom: 12,
  },
  sectionHeader: {
    color: "#8E95A5",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
  },
  projectCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141721",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1E2333",
  },
  projectThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  thumbDurationBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  thumbDurationText: {
    color: "#00F2FE",
    fontSize: 8,
    fontWeight: "800",
  },
  projectTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  projectMeta: {
    color: "#8E95A5",
    fontSize: 11,
    marginTop: 4,
  },
  projectActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1E2333",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnRename: {
    backgroundColor: "rgba(0, 242, 254, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(0, 242, 254, 0.3)",
  },
  inlineRenameBtn: {
    padding: 3,
    borderRadius: 4,
    backgroundColor: "rgba(0, 242, 254, 0.1)",
  },
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
    borderWidth: 1.5,
    borderColor: "#252B3B",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  modalHeaderIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 242, 254, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },
  modalSubtitle: {
    color: "#8E95A5",
    fontSize: 12,
    marginBottom: 16,
  },
  titleInput: {
    backgroundColor: "#0B0D13",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#00F2FE",
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 20,
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#1E2333",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: "#8E95A5",
    fontSize: 13,
    fontWeight: "700",
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    color: "#000000",
    fontSize: 13,
    fontWeight: "900",
  },
  resumeCard: {
    backgroundColor: "rgba(0, 242, 254, 0.08)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: "rgba(0, 242, 254, 0.4)",
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resumeLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  resumePlayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#00F2FE",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  resumeTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  resumeTag: {
    backgroundColor: "#00F2FE",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  resumeTagText: {
    color: "#000000",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  resumeTimeText: {
    color: "#00F2FE",
    fontSize: 11,
    fontWeight: "700",
  },
  resumeTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  resumeMeta: {
    color: "#8E95A5",
    fontSize: 11,
    marginTop: 2,
  },
  resumeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#00F2FE",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  resumeBtnText: {
    color: "#000000",
    fontSize: 12,
    fontWeight: "800",
  },
});
