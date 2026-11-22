import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, StyleSheet, Platform, ScrollView } from "react-native";
import { TactileTouchable as TouchableOpacity } from "./TactileTouchable";
import { Ionicons } from "@expo/vector-icons";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[FastArt ErrorBoundary] Caught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="warning-outline" size={32} color="#EF4444" />
            </View>

            <Text style={styles.title}>
              {this.props.fallbackTitle || "Something went wrong in preview"}
            </Text>

            <Text style={styles.message}>
              {this.state.error?.message || "An unexpected rendering error occurred."}
            </Text>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={this.handleReload}
                activeOpacity={0.7}
              >
                <Ionicons name="refresh-outline" size={16} color="#000000" />
                <Text style={styles.retryBtnText}>Reload Preview</Text>
              </TouchableOpacity>
            </View>

            {__DEV__ && this.state.errorInfo?.componentStack && (
              <ScrollView style={styles.stackTraceContainer} nestedScrollEnabled>
                <Text style={styles.stackTraceText}>
                  {this.state.errorInfo.componentStack}
                </Text>
              </ScrollView>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121214",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#18181A",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    maxWidth: 480,
    width: "100%",
    borderWidth: 1,
    borderColor: "#27272A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  title: {
    color: "#EDEDED",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 6,
  },
  message: {
    color: "#71717A",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 17,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryBtnText: {
    color: "#121214",
    fontSize: 12,
    fontWeight: "600",
  },
  stackTraceContainer: {
    marginTop: 14,
    maxHeight: 140,
    width: "100%",
    backgroundColor: "#141416",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#27272A",
    padding: 10,
  },
  stackTraceText: {
    color: "#71717A",
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
});

