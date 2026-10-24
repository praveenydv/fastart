import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  useWindowDimensions,
  Platform,
} from "react-native";
import {
  Ionicons,
  Feather,
} from "@expo/vector-icons";
import FastArtLogo from "./FastArtLogo";
import { soundEngine } from "../utils/audioEngine";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import { styles } from "./HomeDashboard/HomeDashboardStyles";
import { ProjectCardItem } from "./HomeDashboard/ProjectCardItem";
import { ProjectOptionsMenu } from "./HomeDashboard/ProjectOptionsMenu";
import { RenameProjectModal } from "./HomeDashboard/RenameProjectModal";
import { formatPlayheadTime } from "./Timeline/timelineUtils";
import { theme } from "../constants/theme";

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
}: HomeDashboardProps) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const isWideScreen = width >= 1180;

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"updated" | "title" | "duration">("updated");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [newTileHovered, setNewTileHovered] = useState(false);

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

  const filteredAndSortedProjects = useMemo(() => {
    let list = [...projects];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.aspectRatio?.toLowerCase().includes(q) ||
          p.resolution?.toLowerCase().includes(q)
      );
    }

    if (sortBy === "title") {
      list.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    } else if (sortBy === "duration") {
      list.sort((a, b) => (b.duration || 0) - (a.duration || 0));
    } else {
      // Newest updated first
      list.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
    }

    return list;
  }, [projects, searchQuery, sortBy]);

  const cycleSortOrder = () => {
    soundEngine.playSfx("click");
    if (sortBy === "updated") setSortBy("title");
    else if (sortBy === "title") setSortBy("duration");
    else setSortBy("updated");
  };

  const sortLabel =
    sortBy === "updated"
      ? "Newest first"
      : sortBy === "title"
      ? "Name (A-Z)"
      : "Duration";

  return (
    <View style={styles.container}>
      {/* Toast Notification */}
      {toastMessage && (
        <View style={styles.toastNotification}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Top Navbar */}
      <View style={styles.navBar}>
        <View
          style={[
            styles.navBarInner,
            isDesktop ? styles.desktopPageWrapper : styles.mobilePageWrapper,
          ]}
        >
          {/* Logo & Branding */}
          <View style={styles.logoRow}>
            <FastArtLogo size={28} />
            <Text style={styles.logoText}>FastArt</Text>
            {isDesktop && (
              <View style={styles.studioBadge}>
                <Text style={styles.studioBadgeText}>STUDIO</Text>
              </View>
            )}
          </View>

          {/* Desktop Integrated Search Bar */}
          {isDesktop && (
            <View style={styles.desktopSearchContainer}>
              <Ionicons name="search" size={15} color="#94A3B8" />
              <TextInput
                style={styles.desktopSearchInput}
                placeholder="Search projects by name, aspect ratio..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery ? (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={15} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {/* Right Action Controls */}
          <View style={styles.navActions}>
            {/* Desktop Quick "+ New Project" Button */}
            {isDesktop && (
              <TouchableOpacity
                style={styles.desktopNewProjectBtn}
                onPress={() => {
                  soundEngine.playSfx("whoosh");
                  onCreateNewProject();
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="add" size={18} color="#000000" />
                <Text style={styles.desktopNewProjectBtnText}>New Project</Text>
              </TouchableOpacity>
            )}

            {/* Notification Bell */}
            <TouchableOpacity
              style={styles.navIconBtn}
              activeOpacity={0.7}
              onPress={() => {
                soundEngine.playSfx("click");
                onOpenNotifications();
              }}
              accessibilityLabel="Notifications"
            >
              <Ionicons name="notifications-outline" size={18} color="#FFFFFF" />
              {unreadNotificationsCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadNotificationsCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Settings Gear */}
            <TouchableOpacity
              style={styles.navIconBtn}
              activeOpacity={0.7}
              onPress={() => {
                soundEngine.playSfx("click");
                onOpenSettings();
              }}
              accessibilityLabel="Settings"
            >
              <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={
            isDesktop ? styles.desktopPageWrapper : styles.mobilePageWrapper
          }
        >
          {/* Mobile Hero "+ New Project" Card */}
          {!isDesktop && (
            <>
              <View style={styles.mobileHeroSection}>
                <TouchableOpacity
                  style={styles.mobileNewProjectButton}
                  onPress={() => {
                    soundEngine.playSfx("whoosh");
                    onCreateNewProject();
                  }}
                  activeOpacity={0.85}
                >
                  <View style={styles.mobilePlusCircle}>
                    <Ionicons name="add" size={26} color="#000000" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mobileNewProjectTitle}>New Project</Text>
                    <Text style={styles.mobileNewProjectSubtitle}>
                      Start creating with video, photos & audio
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Mobile Search Bar */}
              <View style={styles.mobileSearchBar}>
                <Ionicons name="search" size={16} color="#64748B" />
                <TextInput
                  style={styles.mobileSearchInput}
                  placeholder="Search projects..."
                  placeholderTextColor="#64748B"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery ? (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </>
          )}

          {/* Projects Section Header */}
          <View style={styles.projectsSection}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>Projects</Text>
                <View style={styles.countPill}>
                  <Text style={styles.countPillText}>
                    {filteredAndSortedProjects.length}
                  </Text>
                </View>
              </View>

              {/* Sort Toggle Button */}
              {projects.length > 1 && (
                <TouchableOpacity
                  style={styles.sortBtn}
                  onPress={cycleSortOrder}
                  activeOpacity={0.7}
                >
                  <Feather name="arrow-down" size={13} color="#94A3B8" />
                  <Text style={styles.sortBtnText}>{sortLabel}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Empty State */}
            {filteredAndSortedProjects.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBox}>
                  <Ionicons name="film-outline" size={32} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>
                  {searchQuery ? "No matching projects" : "No projects yet"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery
                    ? "Try searching with another title or clear your query."
                    : "Create your first project and bring your video ideas to life."}
                </Text>
                {!searchQuery && (
                  <TouchableOpacity
                    style={styles.emptyCreateBtn}
                    onPress={() => {
                      soundEngine.playSfx("whoosh");
                      onCreateNewProject();
                    }}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add" size={18} color="#000000" />
                    <Text style={styles.emptyCreateBtnText}>Create Project</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : isDesktop ? (
              /* Desktop Multi-Column Responsive Grid View */
              <View style={styles.desktopGridContainer}>
                {/* 1st Tile: Dedicated "+ Create Project" Grid Tile */}
                <TouchableOpacity
                  style={[
                    styles.desktopNewProjectTile,
                    isWideScreen ? styles.desktopGridCol4 : styles.desktopGridCol3,
                    newTileHovered && styles.desktopNewProjectTileHovered,
                  ]}
                  onPress={() => {
                    soundEngine.playSfx("whoosh");
                    onCreateNewProject();
                  }}
                  activeOpacity={0.85}
                  {...(Platform.OS === "web"
                    ? ({
                        onMouseEnter: () => setNewTileHovered(true),
                        onMouseLeave: () => setNewTileHovered(false),
                      } as any)
                    : {})}
                >
                  <View style={styles.desktopPlusRing}>
                    <Ionicons name="add" size={28} color="#FFFFFF" />
                  </View>
                  <Text style={styles.desktopTileTitle}>New Project</Text>
                  <Text style={styles.desktopTileSub}>
                    Start from blank canvas or import media
                  </Text>
                </TouchableOpacity>

                {/* Project Grid Tiles */}
                {filteredAndSortedProjects.map((proj) => (
                  <View
                    key={proj.id}
                    style={
                      isWideScreen
                        ? styles.desktopGridCol4
                        : styles.desktopGridCol3
                    }
                  >
                    <ProjectCardItem
                      project={proj}
                      variant="grid"
                      onOpenProject={onOpenProject}
                      onOptionsPress={setOptionsProject}
                    />
                  </View>
                ))}
              </View>
            ) : (
              /* Mobile Clean List Cards View */
              <View style={styles.mobileListContainer}>
                {filteredAndSortedProjects.map((proj) => (
                  <ProjectCardItem
                    key={proj.id}
                    project={proj}
                    variant="list"
                    onOpenProject={onOpenProject}
                    onOptionsPress={setOptionsProject}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
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
        message="Are you sure you want to delete this project? This will permanently delete the draft and all its edits."
        itemName={projectToDelete?.title}
        itemType="Project"
        itemDetails={
          projectToDelete
            ? `${projectToDelete.aspectRatio || "9:16"} • ${projectToDelete.resolution || "1080p"} • ${formatDuration(projectToDelete.duration || 0)}`
            : undefined
        }
        confirmText="Delete"
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
