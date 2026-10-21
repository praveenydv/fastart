import { Platform } from "react-native";
import { addNotification } from "./storage";

export interface DownloadNotificationDetails {
  filename: string;
  destinationPath: string;
  projectId?: string;
  projectTitle?: string;
  fileSize?: number;
}

/**
 * Triggers both in-app notification center recording and Android/iOS system notifications
 * so the user clearly sees where their file has been downloaded.
 */
export async function triggerDownloadNotification({
  filename,
  destinationPath,
  projectId,
  projectTitle,
  fileSize,
}: DownloadNotificationDetails): Promise<void> {
  const displayLocation = destinationPath || "Device Gallery / DCIM / FastArt";

  // 1. In-App Notification Center
  try {
    addNotification({
      title: "Download Complete",
      message: `"${filename}" saved to ${displayLocation}.`,
      projectId,
      projectTitle,
      actionText: "Open File",
      icon: "cloud-done",
    });
  } catch (err) {
    console.warn("Could not save to in-app notification storage:", err);
  }

  // 2. Mobile Native Notification (Android notification shade & iOS notification center)
  if (Platform.OS === "android" || Platform.OS === "ios") {
    try {
      // Safely check for expo-notifications without crashing if not linked
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const Notifications = require("expo-notifications");
      if (Notifications && typeof Notifications.scheduleNotificationAsync === "function") {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "FastArt • Download Complete",
            body: `${filename}\nSaved to ${displayLocation}`,
            data: { filename, destinationPath: displayLocation, fileSize },
          },
          trigger: null, // deliver immediately
        });
      }
    } catch {
      // Gracefully continue if native notification module is not compiled into the running APK
    }
  }
}
