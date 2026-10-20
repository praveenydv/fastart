import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../../utils/audioEngine';

export default function NotificationsModal({
  visible,
  onClose,
  notifications = [],
  onMarkAllAsRead,
  onClearAll,
  onActionClick,
}) {
  const [activeTab, setActiveTab] = useState('all');

  const filtered = notifications.filter((n) => {
    if (activeTab === 'all') return true;
    return n.type === activeTab;
  });

  const unreadCount = notifications.filter((n) => n.unread).length;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.sheetTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadCountBadge}>
                  <Text style={styles.unreadCountText}>{unreadCount} new</Text>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {unreadCount > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    soundEngine.playSfx('click');
                    onMarkAllAsRead();
                  }}
                >
                  <Text style={styles.markReadText}>Mark read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
              onPress={() => setActiveTab('all')}
            >
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'creative' && styles.tabBtnActive]}
              onPress={() => setActiveTab('creative')}
            >
              <Text style={[styles.tabText, activeTab === 'creative' && styles.tabTextActive]}>
                Creative Tips
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'update' && styles.tabBtnActive]}
              onPress={() => setActiveTab('update')}
            >
              <Text style={[styles.tabText, activeTab === 'update' && styles.tabTextActive]}>
                Updates
              </Text>
            </TouchableOpacity>
          </View>

          {/* Notifications List */}
          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {filtered.map((item) => (
              <View
                key={item.id}
                style={[styles.notifCard, item.unread && styles.notifCardUnread]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.iconCircle}>
                    <Ionicons
                      name={
                        item.type === 'creative'
                          ? 'musical-notes'
                          : item.type === 'update'
                          ? 'sparkles'
                          : 'rocket'
                      }
                      size={18}
                      color="#00F2FE"
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardTimestamp}>{item.timestamp}</Text>
                  </View>
                  {item.unread && <View style={styles.unreadDot} />}
                </View>

                <Text style={styles.cardBody}>{item.body}</Text>

                <TouchableOpacity
                  style={styles.cardActionBtn}
                  onPress={() => {
                    soundEngine.playSfx('whoosh');
                    onActionClick();
                    onClose();
                  }}
                >
                  <Text style={styles.cardActionText}>Try in FastArt Studio ➔</Text>
                </TouchableOpacity>
              </View>
            ))}

            {filtered.length === 0 && (
              <View style={styles.emptyContainer}>
                <Ionicons name="notifications-off-outline" size={48} color="#4B5563" />
                <Text style={styles.emptyText}>No notifications in this tab</Text>
              </View>
            )}

            {notifications.length > 0 && (
              <TouchableOpacity
                style={styles.clearAllBtn}
                onPress={() => {
                  soundEngine.playSfx('pop');
                  onClearAll();
                }}
              >
                <Text style={styles.clearAllText}>Clear All Notifications</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#141721',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: '#252B3B',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  unreadCountBadge: {
    backgroundColor: 'rgba(0, 242, 254, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00F2FE',
  },
  unreadCountText: {
    color: '#00F2FE',
    fontSize: 11,
    fontWeight: '800',
  },
  markReadText: {
    color: '#8E95A5',
    fontSize: 13,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#10131A',
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  tabBtnActive: {
    backgroundColor: '#1E2333',
    borderColor: '#00F2FE',
  },
  tabText: {
    color: '#8E95A5',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#00F2FE',
    fontWeight: '800',
  },
  sheetBody: {
    padding: 16,
  },
  notifCard: {
    backgroundColor: '#10131A',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1E2333',
  },
  notifCardUnread: {
    borderColor: '#2A3A55',
    backgroundColor: '#131924',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cardTimestamp: {
    color: '#8E95A5',
    fontSize: 10,
    marginTop: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00F2FE',
  },
  cardBody: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  cardActionBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 242, 254, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  cardActionText: {
    color: '#00F2FE',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 12,
  },
  clearAllBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 20,
  },
  clearAllText: {
    color: '#FF0050',
    fontSize: 13,
    fontWeight: '700',
  },
});
