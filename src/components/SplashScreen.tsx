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
    backgroundColor: "#121214",
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
    top: -20,
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    marginBottom: 18,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 18,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 8,
  },
  appName: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  subtitle: {
    color: "#71717A",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginBottom: 28,
  },
  progressTrack: {
    width: 200,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#27272A",
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 1,
  },
  statusText: {
    color: "#A1A1AA",
    fontSize: 11,
    fontWeight: "400",
    letterSpacing: 0.2,
  },
  footer: {
    position: "absolute",
    bottom: 28,
    alignItems: "center",
  },
  footerText: {
    color: "#52525B",
    fontSize: 10,
    fontWeight: "400",
    letterSpacing: 0.4,
  },
});
