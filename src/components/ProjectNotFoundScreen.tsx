import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../utils/audioEngine';

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
          <Ionicons name="film-outline" size={48} color="#FF0050" />
        </View>

        <Text style={styles.title}>Project Not Found</Text>
        <Text style={styles.subtitle}>
          We couldn't find a project with key:{' '}
          <Text style={styles.keyText}>"{projectKey}"</Text>
        </Text>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => {
              soundEngine.playSfx('whoosh');
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
                soundEngine.playSfx('click');
                onOpenDefault();
              }}
            >
              <Text style={styles.secondaryBtnText}>Open Recent Project</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.textBtn}
            onPress={() => {
              soundEngine.playSfx('click');
              onGoHome();
            }}
          >
            <Ionicons name="home-outline" size={16} color="#8E95A5" />
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
    backgroundColor: '#0B0D13',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
    backgroundColor: '#141721',
    padding: 32,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255, 0, 80, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 0, 80, 0.3)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    color: '#8E95A5',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  keyText: {
    color: '#00F2FE',
    fontWeight: '700',
  },
  actionsRow: {
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#00F2FE',
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E2333',
    paddingVertical: 12,
    borderRadius: 10,
  },
  secondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  textBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  textBtnText: {
    color: '#8E95A5',
    fontSize: 13,
    fontWeight: '600',
  },
});
