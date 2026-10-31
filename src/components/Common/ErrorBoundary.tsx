import React, { Component, ErrorInfo, ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView } from "react-native";
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
    backgroundColor: "#08090E",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#131826",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    maxWidth: 480,
    width: "100%",
    borderWidth: 1,
    borderColor: "#1F2637",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    color: "#94A3B8",
    fontSize: 12.5,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#00F2FE",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: "#08090E",
    fontSize: 13,
    fontWeight: "700",
  },
  stackTraceContainer: {
    marginTop: 16,
    maxHeight: 140,
    width: "100%",
    backgroundColor: "#0B0E17",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1A2234",
  },
  stackTraceText: {
    color: "#64748B",
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
});

