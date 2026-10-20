import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../utils/audioEngine';

interface NotificationsScreenProps {
  notifications: any[];
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onActionClick: () => void;
  onBack: () => void;
}

export default function NotificationsScreen({
  notifications = [],
  onMarkAllAsRead,
  onClearAll,
  onActionClick,
  onBack,
}: NotificationsScreenProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'creative' | 'update'>('all');

  const filtered = notifications.filter((n) => {
    if (activeTab === 'all') return true;
    return n.type === activeTab;
  });

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <View style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            soundEngine.playSfx('click');
            onBack();
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <Text style={styles.navTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadCountBadge}>
              <Text style={styles.unreadCountText}>{unreadCount} new</Text>
            </View>
          )}
        </View>

        <View style={styles.navActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              style={styles.markReadBtn}
              onPress={() => {
                soundEngine.playSfx('click');
                onMarkAllAsRead();
              }}
            >
              <Text style={styles.markReadText}>Mark read</Text>
            </TouchableOpacity>
          )}

          {notifications.length > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                soundEngine.playSfx('pop');
                onClearAll();
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#8E95A5" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.innerWrapper}>
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
              onPress={() => {
                soundEngine.playSfx('click');
                setActiveTab('all');
              }}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                All ({notifications.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'creative' && styles.tabBtnActive]}
              onPress={() => {
                soundEngine.playSfx('click');
                setActiveTab('creative');
              }}
            >
              <Text style={[styles.tabText, activeTab === 'creative' && styles.tabTextActive]}>
                Creative Tips
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'update' && styles.tabBtnActive]}
              onPress={() => {
                soundEngine.playSfx('click');
                setActiveTab('update');
              }}
            >
              <Text style={[styles.tabText, activeTab === 'update' && styles.tabTextActive]}>
                Updates
              </Text>
            </TouchableOpacity>
          </View>

          {/* Notifications List */}
          {filtered.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="notifications-off-outline" size={44} color="#64748B" />
              </View>
              <Text style={styles.emptyTitle}>No Notifications</Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'all'
                  ? "You're all caught up! New tips and updates will show up here."
                  : `No ${activeTab} notifications at the moment.`}
              </Text>
            </View>
          ) : (
            filtered.map((item) => (
              <View
                key={item.id}
                style={[styles.notifCard, item.unread && styles.notifCardUnread]}
              >
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.iconCircle,
                      item.type === 'creative' && styles.iconCircleCreative,
                      item.type === 'update' && styles.iconCircleUpdate,
                    ]}
                  >
                    <Ionicons
                      name={
                        item.icon ||
                        (item.type === 'creative' ? 'bulb-outline' : 'sparkles-outline')
                      }
                      size={20}
                      color={item.type === 'creative' ? '#00F2FE' : '#FFE600'}
                    />
                  </View>

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={styles.titleLine}>
                      <Text style={styles.notifTitle}>{item.title}</Text>
                      {item.unread && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.timeText}>{item.time || 'Recently'}</Text>
                  </View>
                </View>

                <Text style={styles.notifDesc}>{item.description}</Text>

                {item.actionText && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => {
                      soundEngine.playSfx('whoosh');
                      onActionClick();
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.actionBtnText}>{item.actionText}</Text>
                    <Ionicons name="arrow-forward" size={14} color="#000000" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0D13',
  },
  navBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E29',
    backgroundColor: '#0E1118',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingRight: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  unreadCountBadge: {
    backgroundColor: '#FF0050',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadCountText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  markReadBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  markReadText: {
    color: '#00F2FE',
    fontSize: 13,
    fontWeight: '700',
  },
  clearBtn: {
    padding: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    padding: 16,
  },
  innerWrapper: {
    width: '100%',
    maxWidth: 720,
  },
  headerInfo: {
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  urlBadge: {
    color: '#00F2FE',
    fontSize: 11,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    backgroundColor: 'rgba(0, 242, 254, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 242, 254, 0.2)',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#141721',
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    borderColor: '#00F2FE',
  },
  tabText: {
    color: '#8E95A5',
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#00F2FE',
    fontWeight: '800',
  },
  notifCard: {
    backgroundColor: '#141721',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  notifCardUnread: {
    borderColor: 'rgba(0, 242, 254, 0.4)',
    backgroundColor: '#171B26',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleCreative: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
  },
  iconCircleUpdate: {
    backgroundColor: 'rgba(255, 230, 0, 0.15)',
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00F2FE',
    marginLeft: 8,
  },
  timeText: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
  notifDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  actionBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00F2FE',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  actionBtnText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#141721',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptySubtitle: {
    color: '#8E95A5',
    fontSize: 13,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 18,
  },
});
