import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { soundEngine } from '../utils/audioEngine';

export default function Timeline({
  project,
  currentTime,
  totalDuration,
  onSeek,
  selectedClipId,
  onSelectClip,
  onOpenTransitions,
  onOpenMediaPicker,
  onOpenTextModal,
  onOpenAudioModal,
  onOpenEffectsModal,
  onOpenStickersModal,
  zoom,
  onZoomChange,
}) {
  const scrollRef = useRef(null);
  const screenWidth = Dimensions.get('window').width;

  // Zoom scale: pixels per second (default 60px/s)
  const pxPerSec = zoom || 60;
  const timelineContentWidth = Math.max(screenWidth, totalDuration * pxPerSec + 200);

  // Generate ruler tick marks every second
  const numSeconds = Math.ceil(totalDuration) + 2;
  const ticks = [];
  for (let s = 0; s <= numSeconds; s++) {
    ticks.push(s);
  }

  // Handle tap or scrub on ruler
  const handleRulerPress = (e) => {
    let clickX = 0;
    if (Platform.OS === 'web') {
      const rect = e.currentTarget.getBoundingClientRect();
      clickX = e.clientX - rect.left;
    } else {
      clickX = e.nativeEvent.locationX;
    }
    const newTime = Math.max(0, Math.min(totalDuration, clickX / pxPerSec));
    soundEngine.playSfx('click');
    onSeek(newTime);
  };

  const videoClips = project.tracks.video || [];
  const audioClips = project.tracks.audio || [];
  const textClips = project.tracks.text || [];
  const stickerClips = project.tracks.stickers || [];
  const effectClips = project.tracks.effects || [];

  return (
    <View style={styles.container}>
      {/* Zoom and Track Utility Header */}
      <View style={styles.timelineBar}>
        <View style={styles.trackLabels}>
          <Text style={styles.trackLabelTitle}>TIMELINE TRACKS</Text>
        </View>

        <View style={styles.zoomControls}>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => onZoomChange(Math.max(30, pxPerSec - 15))}
            activeOpacity={0.7}
          >
            <Ionicons name="remove" size={16} color="#8E95A5" />
          </TouchableOpacity>
          <Text style={styles.zoomText}>{pxPerSec}px/s</Text>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => onZoomChange(Math.min(150, pxPerSec + 15))}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={16} color="#8E95A5" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Horizontal Scrollable Multi-Track Canvas */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.timelineScroll}
        contentContainerStyle={[styles.timelineContent, { width: timelineContentWidth }]}
      >
        {/* Time Ruler */}
        <TouchableOpacity
          style={[styles.rulerContainer, { width: timelineContentWidth }]}
          activeOpacity={1}
          onPress={handleRulerPress}
        >
          {ticks.map((s) => (
            <View key={s} style={[styles.tickWrapper, { left: s * pxPerSec }]}>
              <View style={styles.tickLine} />
              <Text style={styles.tickText}>00:{s.toString().padStart(2, '0')}</Text>
            </View>
          ))}
        </TouchableOpacity>

        {/* Dynamic Vertical Playhead Needle */}
        <View style={[styles.playheadLine, { left: currentTime * pxPerSec }]}>
          <View style={styles.playheadHead}>
            <Ionicons name="caret-down" size={18} color="#00F2FE" />
          </View>
        </View>

        {/* TRACK 1: Text Overlays */}
        <View style={styles.trackLane}>
          <View style={styles.trackHeaderBadge}>
            <Ionicons name="text-outline" size={12} color="#D946EF" />
            <Text style={[styles.trackHeaderLabel, { color: '#D946EF' }]}>Text</Text>
          </View>
          {textClips.map((t) => {
            const left = t.startTime * pxPerSec;
            const width = t.duration * pxPerSec;
            const isSelected = selectedClipId === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.textClipBlock,
                  { left, width },
                  isSelected && styles.clipSelected,
                ]}
                onPress={() => {
                  soundEngine.playSfx('click');
                  onSelectClip(t.id, 'text');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.clipBlockText} numberOfLines={1}>
                  {t.text}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* TRACK 2: Stickers */}
        {stickerClips.length > 0 && (
          <View style={styles.trackLane}>
            <View style={styles.trackHeaderBadge}>
              <Ionicons name="happy-outline" size={12} color="#FBBF24" />
              <Text style={[styles.trackHeaderLabel, { color: '#FBBF24' }]}>Sticker</Text>
            </View>
            {stickerClips.map((s) => {
              const left = s.startTime * pxPerSec;
              const width = s.duration * pxPerSec;
              const isSelected = selectedClipId === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.stickerClipBlock,
                    { left, width },
                    isSelected && styles.clipSelected,
                  ]}
                  onPress={() => onSelectClip(s.id, 'sticker')}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 16 }}>{s.char}</Text>
                  <Text style={styles.clipBlockTextSmall}>
                    {(s.duration || 0).toFixed(1)}s
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* TRACK 3: MAIN VIDEO TRACK (Primary Track) */}
        <View style={[styles.trackLane, styles.mainVideoLane]}>
          <View style={styles.trackHeaderBadge}>
            <Ionicons name="videocam" size={12} color="#00F2FE" />
            <Text style={[styles.trackHeaderLabel, { color: '#00F2FE' }]}>Video</Text>
          </View>

          {videoClips.map((clip, idx) => {
            const left = clip.startTime * pxPerSec;
            const width = clip.duration * pxPerSec;
            const isSelected = selectedClipId === clip.id;

            return (
              <React.Fragment key={clip.id}>
                {/* Video Clip Card */}
                <TouchableOpacity
                  style={[
                    styles.videoClipCard,
                    { left, width },
                    isSelected && styles.clipSelected,
                  ]}
                  onPress={() => {
                    soundEngine.playSfx('click');
                    onSelectClip(clip.id, 'video');
                  }}
                  activeOpacity={0.85}
                >
                  {/* Left Trim Handle (When selected) */}
                  {isSelected && (
                    <View style={[styles.trimHandle, styles.trimHandleLeft]}>
                      <View style={styles.trimGripBar} />
                    </View>
                  )}

                  {/* Thumbnail / Title Content */}
                  <View style={styles.clipInnerContent}>
                    <View style={styles.clipBadge}>
                      <Text style={styles.clipBadgeText}>{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1, paddingHorizontal: 6 }}>
                      <Text style={styles.clipTitleText} numberOfLines={1}>
                        {clip.title}
                      </Text>
                      <Text style={styles.clipDurationSubtext}>
                        {(clip.duration || 0).toFixed(1)}s • {clip.speed || 1}x
                      </Text>
                    </View>
                    {clip.filter !== 'normal' && (
                      <View style={styles.filterTag}>
                        <Text style={styles.filterTagText}>LUT</Text>
                      </View>
                    )}
                  </View>

                  {/* Right Trim Handle (When selected) */}
                  {isSelected && (
                    <View style={[styles.trimHandle, styles.trimHandleRight]}>
                      <View style={styles.trimGripBar} />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Transition Cut Button between clips */}
                {idx < videoClips.length - 1 && (
                  <TouchableOpacity
                    style={[
                      styles.transitionButton,
                      { left: (clip.startTime + clip.duration) * pxPerSec - 12 },
                    ]}
                    onPress={() => onOpenTransitions(clip.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="flash" size={10} color="#00F2FE" />
                  </TouchableOpacity>
                )}
              </React.Fragment>
            );
          })}

          {videoClips.length === 0 && (
            <TouchableOpacity
              style={styles.emptyVideoTrackCard}
              onPress={onOpenMediaPicker}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle" size={20} color="#00F2FE" />
              <Text style={styles.emptyVideoTrackText}>+ Add Video or Photo from Device</Text>
            </TouchableOpacity>
          )}

          {/* Add Media [+] button at the end of video track */}
          {videoClips.length > 0 && (
            <TouchableOpacity
              style={[
                styles.addMediaEndBtn,
                {
                  left:
                    (videoClips[videoClips.length - 1].startTime +
                      videoClips[videoClips.length - 1].duration) *
                      pxPerSec +
                    12,
                },
              ]}
              onPress={onOpenMediaPicker}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={20} color="#00F2FE" />
              <Text style={styles.addMediaText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* TRACK 4: Audio Track (Waveform visualization) */}
        <View style={styles.trackLane}>
          <View style={styles.trackHeaderBadge}>
            <Ionicons name="musical-notes" size={12} color="#10B981" />
            <Text style={[styles.trackHeaderLabel, { color: '#10B981' }]}>Audio</Text>
          </View>
          {audioClips.map((a) => {
            const left = a.startTime * pxPerSec;
            const width = a.duration * pxPerSec;
            const isSelected = selectedClipId === a.id;
            return (
              <TouchableOpacity
                key={a.id}
                style={[
                  styles.audioClipBlock,
                  { left, width },
                  isSelected && styles.clipSelected,
                ]}
                onPress={() => {
                  soundEngine.playSfx('click');
                  onSelectClip(a.id, 'audio');
                }}
                activeOpacity={0.8}
              >
                <View style={styles.audioWaveformRow}>
                  {Array.from({ length: Math.min(40, Math.floor(width / 6)) }).map((_, i) => {
                    const barH = 6 + Math.abs(Math.sin(i * 0.8) * 16);
                    return <View key={i} style={[styles.waveBar, { height: barH }]} />;
                  })}
                </View>
                <Text style={styles.audioTitleText} numberOfLines={1}>
                  🎵 {a.title}
                </Text>
              </TouchableOpacity>
            );
          })}

          {audioClips.length === 0 && (
            <TouchableOpacity
              style={[styles.addAudioPlaceholder, { left: 10 }]}
              onPress={onOpenAudioModal}
              activeOpacity={0.7}
            >
              <Ionicons name="add-circle-outline" size={16} color="#10B981" />
              <Text style={styles.addAudioPlaceholderText}>+ Add Audio / BGM</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* TRACK 5: Effects Track */}
        {effectClips.length > 0 && (
          <View style={styles.trackLane}>
            <View style={styles.trackHeaderBadge}>
              <Ionicons name="sparkles" size={12} color="#F59E0B" />
              <Text style={[styles.trackHeaderLabel, { color: '#F59E0B' }]}>Effects</Text>
            </View>
            {effectClips.map((eff) => {
              const left = eff.startTime * pxPerSec;
              const width = eff.duration * pxPerSec;
              return (
                <View key={eff.id} style={[styles.effectClipBlock, { left, width }]}>
                  <Text style={styles.effectText} numberOfLines={1}>
                    ✨ {eff.name}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0E1118',
    height: 250,
    borderTopWidth: 1,
    borderTopColor: '#1A1E29',
  },
  timelineBar: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    backgroundColor: '#0B0D13',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E29',
  },
  trackLabels: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackLabelTitle: {
    color: '#8E95A5',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zoomBtn: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    color: '#8E95A5',
    fontSize: 10,
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'center',
  },
  timelineScroll: {
    flex: 1,
  },
  timelineContent: {
    paddingVertical: 4,
    position: 'relative',
  },
  rulerContainer: {
    height: 22,
    position: 'relative',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E29',
  },
  tickWrapper: {
    position: 'absolute',
    top: 0,
    alignItems: 'flex-start',
  },
  tickLine: {
    width: 1,
    height: 8,
    backgroundColor: '#374151',
  },
  tickText: {
    color: '#6B7280',
    fontSize: 9,
    fontFamily: 'monospace',
    marginTop: 2,
    marginLeft: 2,
  },
  playheadLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#00F2FE',
    zIndex: 20,
    pointerEvents: 'none',
  },
  playheadHead: {
    position: 'absolute',
    top: -2,
    left: -8,
  },
  trackLane: {
    height: 38,
    marginVertical: 2,
    position: 'relative',
    justifyContent: 'center',
  },
  mainVideoLane: {
    height: 60,
  },
  trackHeaderBadge: {
    position: 'absolute',
    left: 4,
    top: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 5,
    backgroundColor: 'rgba(11, 13, 19, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  trackHeaderLabel: {
    fontSize: 9,
    fontWeight: '700',
  },
  videoClipCard: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
  },
  clipInnerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  clipBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '800',
  },
  clipTitleText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  clipDurationSubtext: {
    color: '#94A3B8',
    fontSize: 9,
  },
  filterTag: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  filterTagText: {
    color: '#FBBF24',
    fontSize: 8,
    fontWeight: '800',
  },
  clipSelected: {
    borderColor: '#FFFFFF',
    borderWidth: 2,
    shadowColor: '#00F2FE',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
  },
  trimHandle: {
    width: 12,
    height: '100%',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  trimHandleLeft: {
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  trimHandleRight: {
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  trimGripBar: {
    width: 2,
    height: 16,
    backgroundColor: '#000000',
    borderRadius: 1,
  },
  transitionButton: {
    position: 'absolute',
    top: 20,
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: '#0B0D13',
    borderWidth: 1.5,
    borderColor: '#00F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 15,
  },
  emptyVideoTrackCard: {
    position: 'absolute',
    left: 8,
    top: 6,
    bottom: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#141721',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#00F2FE',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyVideoTrackText: {
    color: '#00F2FE',
    fontSize: 12,
    fontWeight: '700',
  },
  addMediaEndBtn: {
    position: 'absolute',
    top: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#141721',
    borderWidth: 1,
    borderColor: '#252B3B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMediaText: {
    color: '#00F2FE',
    fontSize: 9,
    fontWeight: '700',
    marginTop: -2,
  },
  textClipBlock: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    backgroundColor: 'rgba(217, 70, 239, 0.25)',
    borderColor: '#D946EF',
    borderWidth: 1,
    borderRadius: 4,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  clipBlockText: {
    color: '#F0ABFC',
    fontSize: 10,
    fontWeight: '700',
  },
  clipBlockTextSmall: {
    color: '#FEF08A',
    fontSize: 9,
    marginLeft: 4,
  },
  stickerClipBlock: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    backgroundColor: 'rgba(251, 191, 36, 0.2)',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  audioClipBlock: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10B981',
    borderWidth: 1,
    borderRadius: 4,
    justifyContent: 'center',
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  audioWaveformRow: {
    position: 'absolute',
    left: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    opacity: 0.35,
  },
  waveBar: {
    width: 2,
    backgroundColor: '#10B981',
    borderRadius: 1,
  },
  audioTitleText: {
    color: '#6EE7B7',
    fontSize: 10,
    fontWeight: '700',
    zIndex: 2,
  },
  addAudioPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#141721',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  addAudioPlaceholderText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
  },
  effectClipBlock: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 4,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  effectText: {
    color: '#FCD34D',
    fontSize: 10,
    fontWeight: '700',
  },
});
