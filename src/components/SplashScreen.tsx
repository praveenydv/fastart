import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Animated,
  Image,
  Dimensions,
  Platform,
  Easing,
} from "react-native";

interface SplashScreenProps {
  isReady: boolean;
  statusText?: string;
  onFinished?: () => void;
  minDurationMs?: number;
}

export default function SplashScreen({
  isReady,
  statusText = "Initializing FastArt Studio...",
  onFinished,
  minDurationMs = 1200,
}: SplashScreenProps) {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const logoGlow = useRef(new Animated.Value(0.4)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for the glowing halo
  useEffect(() => {
    const useNative = Platform.OS !== "web";

    // Logo entrance scale
    Animated.spring(logoScale, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: useNative,
    }).start();

    // Subtle breathing glow loop
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlow, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
        Animated.timing(logoGlow, {
          toValue: 0.4,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: useNative,
        }),
      ])
    );
    glowLoop.start();

    // Progress animation initial advance
    Animated.timing(progressAnim, {
      toValue: 0.85,
      duration: minDurationMs * 0.8,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    // Minimum display timer
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, minDurationMs);

    // Fallback safety timeout (max 3 seconds)
    const safetyTimer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 3000);

    return () => {
      glowLoop.stop();
      clearTimeout(timer);
      clearTimeout(safetyTimer);
    };
  }, []);

  // When both minimum display duration has passed and the app is ready, complete progress and fade out
  useEffect(() => {
    if (minTimeElapsed && isReady) {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.ease,
        useNativeDriver: false,
      }).start(() => {
        const useNative = Platform.OS !== "web";
        // Cinematic exit fade-out
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: useNative,
          }),
          Animated.timing(logoScale, {
            toValue: 1.08,
            duration: 400,
            easing: Easing.out(Easing.quad),
            useNativeDriver: useNative,
          }),
        ]).start(() => {
          if (onFinished) {
            onFinished();
          }
        });
      });
    }
  }, [minTimeElapsed, isReady]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
        },
      ]}
      pointerEvents={minTimeElapsed && isReady ? "none" : "auto"}
    >
      <View style={styles.centerBox}>
        {/* Animated Glow Ring Behind Logo */}
        <Animated.View
          style={[
            styles.glowRing,
            {
              opacity: logoGlow,
              transform: [{ scale: logoScale }],
            },
          ]}
        />

        {/* Branded FastArt Logo */}
        <Animated.View
          style={[
            styles.logoContainer,
            {
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image
            source={require("../../assets/fastart_logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* App Title */}
        <View style={styles.titleRow}>
          <Text style={styles.appName}>FastArt</Text>
        </View>

        {/* Subtitle */}
        <Text style={styles.subtitle}>AI-POWERED VIDEO EDITOR</Text>

        {/* Progress Bar Container */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressWidth,
              },
            ]}
          />
        </View>

        {/* Status Message */}
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      {/* Footer Info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Ultra-Fast Cross-Platform Creative Suite</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0B0D13",
    zIndex: 999999,
    justifyContent: "center",
    alignItems: "center",
  },
  centerBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  glowRing: {
    position: "absolute",
    top: -24,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(0, 242, 254, 0.16)",
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 30,
    elevation: 20,
  },
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 12,
    marginBottom: 20,
  },
  logoImage: {
    width: 88,
    height: 88,
    borderRadius: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  appName: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  subtitle: {
    color: "#7E8B9B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 32,
  },
  progressTrack: {
    width: 220,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#1A1D27",
    overflow: "hidden",
    marginBottom: 14,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#00F2FE",
    borderRadius: 2,
    shadowColor: "#00F2FE",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  statusText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.4,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    alignItems: "center",
  },
  footerText: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.6,
  },
});
