import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TactileTouchable as TouchableOpacity } from './Common/TactileTouchable';
import { Ionicons } from '@expo/vector-icons';

interface ProjectNotFoundScreenProps {
  projectKey: string;
  onGoHome: () => void;
  onCreateNew: () => void;
  onOpenDefault?: () => void;
}

export default function ProjectNotFoundScreen({
  projectKey,
  onGoHome,
  onCreateNew,
  onOpenDefault,
}: ProjectNotFoundScreenProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="film-outline" size={40} color="#FFFFFF" />
        </View>

        <Text style={styles.title}>Project Not Found</Text>
        <Text style={styles.subtitle}>
          We couldn&apos;t find a project with key:{' '}
          <Text style={styles.keyText}>&quot;{projectKey}&quot;</Text>
        </Text>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              onCreateNew();
            }}
          >
            <Ionicons name="add" size={18} color="#000000" />
            <Text style={styles.primaryBtnText}>Create New Project</Text>
          </TouchableOpacity>

          {onOpenDefault && (
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => {
                onOpenDefault();
              }}
            >
              <Text style={styles.secondaryBtnText}>Open Recent Project</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.textBtn}
            onPress={() => {
              onGoHome();
            }}
          >
            <Ionicons name="home-outline" size={16} color="#71717A" />
            <Text style={styles.textBtnText}>Go to Home Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
    backgroundColor: '#18181C',
    padding: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#27272F',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#202026',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#27272F',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#A1A1AA',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  keyText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  actionsRow: {
    width: '100%',
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 8,
  },
  primaryBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#202026',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#27272F',
  },
  secondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  textBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  textBtnText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '600',
  },
});
