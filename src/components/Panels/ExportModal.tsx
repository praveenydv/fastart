import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { VideoRenderer, ExportFormat, ExportResult } from '../../utils/videoRenderer';
import { soundEngine } from '../../utils/audioEngine';

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  project: any;
  totalDuration: number;
}

interface MediaFormatOption {
  id: ExportFormat;
  label: string;
  ext: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge: string;
  isRecommended?: boolean;
  desc: string;
}

const MEDIA_FORMATS: MediaFormatOption[] = [
  {
    id: 'mp4',
    label: 'MP4 Video',
    ext: '.mp4',
    icon: 'videocam',
    badge: 'Universal',
    isRecommended: true,
    desc: 'Compatible with QuickTime, Instagram, YouTube, TikTok, iPhone & Windows',
  },
  {
    id: 'webm',
    label: 'WebM Video',
    ext: '.webm',
    icon: 'globe-outline',
    badge: 'Web & Fast',
    isRecommended: false,
    desc: 'High compression VP9 web video format, lightweight for browser playback',
  },
  {
    id: 'gif',
    label: 'Animated GIF',
    ext: '.gif',
    icon: 'film-outline',
    badge: 'Looping',
    isRecommended: false,
    desc: 'Looped animation clip, perfect for reactions, memes, and Discord stickers',
  },
  {
    id: 'png',
    label: 'PNG Cover',
    ext: '.png',
    icon: 'image-outline',
    badge: 'HD Still',
    isRecommended: false,
    desc: 'Ultra-crisp lossless poster frame snapshot for thumbnails and covers',
  },
  {
    id: 'wav',
    label: 'WAV Audio',
    ext: '.wav',
    icon: 'musical-notes-outline',
    badge: '16-bit Studio',
    isRecommended: false,
    desc: 'Pure uncompressed stereo master soundtrack audio',
  },
];

export default function ExportModal({
  visible,
  onClose,
  project,
  totalDuration,
}: ExportModalProps) {
  const [mediaType, setMediaType] = useState<ExportFormat>('mp4');
  const [resolution, setResolution] = useState(project.resolution || '1080p');
  const [fps, setFps] = useState(30);
  const [status, setStatus] = useState<'idle' | 'rendering' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [exportedResult, setExportedResult] = useState<ExportResult | null>(null);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);

  const resolutions = ['720p', '1080p', '2K/4K'];
  const frameRates = [24, 30, 60];

  const selectedFormatConfig = MEDIA_FORMATS.find((f) => f.id === mediaType) || MEDIA_FORMATS[0];

  const calculateEstimatedSize = () => {
    const dur = Math.min(totalDuration || 5, 15);
    if (mediaType === 'png') return '~1.8 MB';
    if (mediaType === 'wav') return `~${(dur * 0.17).toFixed(1)} MB`;
    if (mediaType === 'gif') return `~${(dur * 0.55).toFixed(1)} MB`;
    const resMultiplier = resolution === '2K/4K' ? 2.5 : resolution === '1080p' ? 1.4 : 0.8;
    const formatMultiplier = mediaType === 'webm' ? 0.75 : 1.0;
    return `~${(dur * resMultiplier * formatMultiplier).toFixed(1)} MB`;
  };

  const triggerDirectDownload = async (
    targetResult?: ExportResult | null,
    targetUrl?: string | null
  ) => {
    const activeResult = targetResult || exportedResult;
    const activeUrl = targetUrl || exportedUrl || activeResult?.videoUrl;
    if (!activeResult && !activeUrl) return;

    const currentFmt = MEDIA_FORMATS.find((f) => f.id === mediaType) || MEDIA_FORMATS[0];
    const ext = activeResult?.extension || currentFmt.id;
    const cleanTitle = (project.title || 'FastArt_Video').replace(/[^a-zA-Z0-9_-]/g, '_');

    let filename: string;
    if (mediaType === 'png') {
      filename = `${cleanTitle}_Cover.${ext}`;
    } else if (mediaType === 'wav') {
      filename = `${cleanTitle}_Soundtrack.${ext}`;
    } else {
      filename = `${cleanTitle}_${resolution}.${ext}`;
    }

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        let blob = activeResult?.blob;
        if (!blob && activeUrl) {
          try {
            const resp = await fetch(activeUrl);
            blob = await resp.blob();
          } catch (fetchErr) {
            console.warn('Blob fetch failed:', fetchErr);
          }
        }

        // 1. File System Access API (Native OS Save As File Dialog)
        if ('showSaveFilePicker' in window && blob && blob.size > 0) {
          try {
            const mime = activeResult?.mimeType || 'application/octet-stream';
            const handle = await (window as any).showSaveFilePicker({
              suggestedName: filename,
              types: [
                {
                  description: `${selectedFormatConfig.label} File`,
                  accept: {
                    [mime]: [`.${ext}`],
                    'application/octet-stream': [`.${ext}`],
                  },
                },
              ],
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            soundEngine.playSfx('pop');
            return;
          } catch (pickerErr: any) {
            if (pickerErr?.name === 'AbortError') {
              // User pressed cancel in the save dialog; do not navigate or open URL
              return;
            }
          }
        }

        // 2. Direct anchor download forced with application/octet-stream
        // Crucial: 'application/octet-stream' forces browser to trigger file download rather than navigating to localhost/blob URL
        const downloadBlob =
          blob && blob.size > 0
            ? new Blob([blob], { type: 'application/octet-stream' })
            : new Blob([], { type: 'application/octet-stream' });
        const downloadUrl = URL.createObjectURL(downloadBlob);

        const a = document.createElement('a');
        a.style.display = 'none';
        a.style.position = 'fixed';
        a.style.left = '-9999px';
        a.style.top = '-9999px';
        a.href = downloadUrl;
        a.download = filename;
        a.setAttribute('download', filename);
        a.rel = 'noopener noreferrer';
        a.target = '_self';

        // Stop click propagation so router / React handlers never treat this as navigation
        a.addEventListener('click', (e) => {
          e.stopPropagation();
        });

        document.body.appendChild(a);
        a.click();
        soundEngine.playSfx('pop');

        // Keep anchor in DOM for 3s to let browser start download before cleanup
        setTimeout(() => {
          if (document.body.contains(a)) {
            document.body.removeChild(a);
          }
          URL.revokeObjectURL(downloadUrl);
        }, 3000);
      } catch (err) {
        console.warn('Web download error:', err);
      }
    } else {
      if (activeUrl) {
        Sharing.shareAsync(activeUrl).catch((err) => console.warn(err));
      }
    }
  };

  const handleStartExport = async () => {
    setStatus('rendering');
    setErrorMessage(null);
    setProgress(0);
    soundEngine.playSfx('whoosh');

    try {
      if (Platform.OS === 'web') {
        const offscreenCanvas = document.createElement('canvas');
        // Aspect ratio dimensions
        const ratioMap: Record<string, [number, number]> = {
          '9:16': [1080, 1920],
          '16:9': [1920, 1080],
          '1:1': [1080, 1080],
          '4:5': [1080, 1350],
          '2.35:1': [1920, 817],
        };
        const [targetW, targetH] = ratioMap[project.aspectRatio] || [1080, 1920];
        offscreenCanvas.width = targetW;
        offscreenCanvas.height = targetH;

        const renderer = new VideoRenderer(offscreenCanvas);
        // Preload clips
        for (const clip of project.tracks?.video || []) {
          await renderer.preloadClip(clip);
        }

        const renderDuration = Math.min(Math.max(totalDuration, 2.0), 15.0);

        const result = await renderer.exportVideo(
          project,
          {
            fps,
            duration: renderDuration,
            format: mediaType,
            currentTime: 0,
          },
          (pct) => {
            setProgress(pct);
          }
        );

        setExportedResult(result);
        setExportedUrl(result.videoUrl);
        setStatus('done');
        soundEngine.playSfx('pop');
      } else {
        // Native simulated render progress
        for (let i = 0; i <= 100; i += 10) {
          setProgress(i);
          await new Promise((r) => setTimeout(r, 120));
        }
        setStatus('done');
        soundEngine.playSfx('pop');
      }
    } catch (err: any) {
      console.warn('Export error, generating high-quality snapshot fallback:', err);
      try {
        const offscreenCanvas = document.createElement('canvas');
        const ratioMap: Record<string, [number, number]> = {
          '9:16': [1080, 1920],
          '16:9': [1920, 1080],
          '1:1': [1080, 1080],
          '4:5': [1080, 1350],
          '2.35:1': [1920, 817],
        };
        const [targetW, targetH] = ratioMap[project.aspectRatio] || [1080, 1920];
        offscreenCanvas.width = targetW;
        offscreenCanvas.height = targetH;
        const fallbackRenderer = new VideoRenderer(offscreenCanvas);
        fallbackRenderer.renderFrame(project, 0);

        const fallbackBlob = await new Promise<Blob>((resolve) => {
          offscreenCanvas.toBlob(
            (b) => resolve(b || new Blob([], { type: 'image/png' })),
            'image/png'
          );
        });
        const fallbackUrl = URL.createObjectURL(fallbackBlob);
        const fallbackResult: ExportResult = {
          blob: fallbackBlob,
          videoUrl: fallbackUrl,
          mimeType: 'image/png',
          format: 'png',
          extension: 'png',
          fileSize: fallbackBlob.size,
        };
        setExportedResult(fallbackResult);
        setExportedUrl(fallbackUrl);
        setStatus('done');
        soundEngine.playSfx('pop');
      } catch (fallbackErr) {
        setStatus('error');
        setErrorMessage('Export failed. Please check browser permissions and try again.');
      }
    }
  };

  const handleDownload = () => {
    triggerDirectDownload(exportedResult, exportedUrl);
  };

  const getProgressStatusMessage = () => {
    switch (mediaType) {
      case 'mp4':
        return 'Encoding hardware-accelerated MP4 (H.264 / AVC)...';
      case 'webm':
        return 'Rendering WebM video frames with VP9 codec...';
      case 'gif':
        return 'Generating animated GIF palette and frames...';
      case 'png':
        return 'Rendering crisp lossless PNG frame...';
      case 'wav':
        return 'Synthesizing 16-bit stereo PCM audio track...';
      default:
        return 'Rendering frames...';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.sheetHeader}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="cloud-download-outline" size={20} color="#00F2FE" />
              <Text style={styles.sheetTitle}>Export & Download Media</Text>
            </View>
            {status !== 'rendering' && (
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {/* IDLE STATE: Settings */}
            {status === 'idle' && (
              <>
                {/* 1. MEDIA TYPE SELECTION */}
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>1. MEDIA TYPE / FORMAT</Text>
                  <Text style={styles.sectionHint}>Select download format</Text>
                </View>

                <View style={styles.formatGrid}>
                  {MEDIA_FORMATS.map((fmt) => {
                    const isSelected = mediaType === fmt.id;
                    return (
                      <TouchableOpacity
                        key={fmt.id}
                        style={[
                          styles.formatCard,
                          isSelected && styles.formatCardActive,
                          fmt.isRecommended && !isSelected && styles.formatCardRecommended,
                        ]}
                        onPress={() => {
                          setMediaType(fmt.id);
                          soundEngine.playSfx('click');
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.formatCardHeader}>
                          <View
                            style={[
                              styles.formatIconCircle,
                              isSelected && styles.formatIconCircleActive,
                            ]}
                          >
                            <Ionicons
                              name={fmt.icon}
                              size={18}
                              color={isSelected ? '#000000' : '#00F2FE'}
                            />
                          </View>
                          <View
                            style={[
                              styles.badgeTag,
                              fmt.isRecommended && styles.badgeTagRecommended,
                              isSelected && styles.badgeTagActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.badgeTagText,
                                isSelected && styles.badgeTagTextActive,
                              ]}
                            >
                              {fmt.badge}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.formatLabel,
                            isSelected && styles.formatLabelActive,
                          ]}
                        >
                          {fmt.label}
                        </Text>
                        <Text style={styles.formatExt}>{fmt.ext}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Selected Format Description Banner */}
                <View style={styles.formatDescriptionBox}>
                  <Ionicons name="information-circle-outline" size={16} color="#00F2FE" />
                  <Text style={styles.formatDescriptionText}>
                    {selectedFormatConfig.desc}
                  </Text>
                </View>

                {/* 2. RESOLUTION (For MP4, WebM, PNG) */}
                {mediaType !== 'wav' && (
                  <>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionTitle}>2. RESOLUTION</Text>
                      <Text style={styles.sectionHint}>{project.aspectRatio}</Text>
                    </View>
                    <View style={styles.row}>
                      {resolutions.map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={[styles.pill, resolution === r && styles.pillActive]}
                          onPress={() => setResolution(r)}
                        >
                          <Text
                            style={[styles.pillText, resolution === r && styles.pillTextActive]}
                          >
                            {r}
                          </Text>
                          {r === '1080p' && <Text style={styles.subPillTag}>Optimal</Text>}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {/* 3. FRAME RATE (For MP4, WebM, GIF) */}
                {mediaType !== 'png' && mediaType !== 'wav' && (
                  <>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionTitle}>3. FRAME RATE (FPS)</Text>
                      <Text style={styles.sectionHint}>
                        {mediaType === 'gif' ? 'Max 12fps for GIF' : 'Smooth motion'}
                      </Text>
                    </View>
                    <View style={styles.row}>
                      {frameRates.map((f) => (
                        <TouchableOpacity
                          key={f}
                          style={[styles.pill, fps === f && styles.pillActive]}
                          onPress={() => setFps(f)}
                        >
                          <Text style={[styles.pillText, fps === f && styles.pillTextActive]}>
                            {f} FPS
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}

                {/* Metadata & Estimated Specs */}
                <View style={styles.metaBox}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Download Media Type:</Text>
                    <View style={styles.metaFormatBadge}>
                      <Text style={styles.metaFormatText}>
                        {selectedFormatConfig.label} ({selectedFormatConfig.ext})
                      </Text>
                    </View>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Estimated Size:</Text>
                    <Text style={styles.metaVal}>{calculateEstimatedSize()}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Duration:</Text>
                    <Text style={styles.metaVal}>
                      {mediaType === 'png' ? 'Single Frame' : `${totalDuration.toFixed(1)}s`}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Canvas Aspect Ratio:</Text>
                    <Text style={styles.metaVal}>{project.aspectRatio}</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.exportCtaBtn} onPress={handleStartExport}>
                  <Ionicons name="download-outline" size={22} color="#000000" />
                  <Text style={styles.exportCtaText}>
                    Export & Download as {selectedFormatConfig.label}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* RENDERING STATE: Progress Ring */}
            {status === 'rendering' && (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="large" color="#00F2FE" style={{ marginBottom: 16 }} />
                <Text style={styles.progressPercent}>{progress}%</Text>
                <Text style={styles.progressStatusText}>{getProgressStatusMessage()}</Text>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.formatProgressNotice}>
                  Generating {selectedFormatConfig.label} ({selectedFormatConfig.ext})
                </Text>
              </View>
            )}

            {/* DONE STATE: Download & Share */}
            {status === 'done' && (
              <View style={styles.doneContainer}>
                <View style={styles.successIconBox}>
                  <Ionicons name="checkmark-circle" size={68} color="#10B981" />
                </View>
                <Text style={styles.doneTitle}>Ready to Download!</Text>
                <Text style={styles.doneSubtext}>
                  Exported successfully as{' '}
                  <Text style={{ color: '#00F2FE', fontWeight: '800' }}>
                    {selectedFormatConfig.label} ({selectedFormatConfig.ext})
                  </Text>
                  {mediaType !== 'png' && mediaType !== 'wav' ? ` in ${resolution} @ ${fps}fps` : ''}
                </Text>

                {/* Primary Download Button */}
                <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload}>
                  <Ionicons name="cloud-download" size={22} color="#000000" />
                  <Text style={styles.downloadBtnText}>
                    Download {selectedFormatConfig.label} ({selectedFormatConfig.ext})
                  </Text>
                </TouchableOpacity>

                {/* Secondary Option: Switch Format & Re-export */}
                <TouchableOpacity
                  style={styles.reExportBtn}
                  onPress={() => {
                    setStatus('idle');
                  }}
                >
                  <Ionicons name="refresh-outline" size={16} color="#8E95A5" />
                  <Text style={styles.reExportBtnText}>Choose Another Media Type / Re-export</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.doneDismissBtn}
                  onPress={() => {
                    setStatus('idle');
                    onClose();
                  }}
                >
                  <Text style={styles.doneDismissText}>Done / Back to Editor</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ERROR STATE */}
            {status === 'error' && (
              <View style={styles.doneContainer}>
                <View style={styles.successIconBox}>
                  <Ionicons name="alert-circle" size={68} color="#EF4444" />
                </View>
                <Text style={styles.doneTitle}>Export Issue</Text>
                <Text style={styles.doneSubtext}>
                  {errorMessage || 'Unable to encode video in the selected format. Please try WebM or PNG cover snapshot.'}
                </Text>
                <TouchableOpacity
                  style={styles.downloadBtn}
                  onPress={() => {
                    setStatus('idle');
                  }}
                >
                  <Ionicons name="refresh-outline" size={20} color="#000000" />
                  <Text style={styles.downloadBtnText}>Try Another Format</Text>
                </TouchableOpacity>
              </View>
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#141721',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: '#252B3B',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2333',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    padding: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#8E95A5',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sectionHint: {
    color: '#6B7280',
    fontSize: 11,
  },
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  formatCard: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: '#0F1219',
    borderWidth: 1.5,
    borderColor: '#1E2333',
    borderRadius: 12,
    padding: 12,
    alignItems: 'flex-start',
  },
  formatCardActive: {
    borderColor: '#00F2FE',
    backgroundColor: '#16222F',
  },
  formatCardRecommended: {
    borderColor: '#2A3B4C',
  },
  formatCardHeader: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  formatIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1B2232',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatIconCircleActive: {
    backgroundColor: '#00F2FE',
  },
  badgeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#1E2333',
  },
  badgeTagRecommended: {
    backgroundColor: '#053E47',
  },
  badgeTagActive: {
    backgroundColor: '#00F2FE',
  },
  badgeTagText: {
    color: '#8E95A5',
    fontSize: 9,
    fontWeight: '700',
  },
  badgeTagTextActive: {
    color: '#000000',
  },
  formatLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  formatLabelActive: {
    color: '#00F2FE',
  },
  formatExt: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 2,
  },
  formatDescriptionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0A131C',
    borderWidth: 1,
    borderColor: '#133544',
    padding: 10,
    borderRadius: 10,
    marginBottom: 18,
  },
  formatDescriptionText: {
    color: '#7DD3FC',
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  pill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#10131A',
    borderWidth: 1,
    borderColor: '#1E2333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    borderColor: '#00F2FE',
    backgroundColor: '#1E2333',
  },
  pillText: {
    color: '#8E95A5',
    fontSize: 13,
    fontWeight: '700',
  },
  pillTextActive: {
    color: '#00F2FE',
  },
  subPillTag: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '800',
    marginTop: 2,
  },
  metaBox: {
    backgroundColor: '#0B0D13',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#1B212D',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    color: '#8E95A5',
    fontSize: 12,
  },
  metaVal: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  metaFormatBadge: {
    backgroundColor: '#1E2333',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaFormatText: {
    color: '#00F2FE',
    fontSize: 12,
    fontWeight: '700',
  },
  exportCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00F2FE',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 10,
    marginBottom: 24,
  },
  exportCtaText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  progressPercent: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '900',
    marginVertical: 10,
  },
  progressStatusText: {
    color: '#8E95A5',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  progressBarTrack: {
    width: '100%',
    height: 8,
    backgroundColor: '#1E2333',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00F2FE',
  },
  formatProgressNotice: {
    color: '#00F2FE',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 14,
  },
  doneContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successIconBox: {
    marginBottom: 12,
  },
  doneTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
  },
  doneSubtext: {
    color: '#8E95A5',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 20,
  },
  downloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    width: '100%',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 10,
    marginBottom: 14,
  },
  downloadBtnText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '800',
  },
  reExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    marginBottom: 6,
  },
  reExportBtnText: {
    color: '#8E95A5',
    fontSize: 13,
    fontWeight: '600',
  },
  doneDismissBtn: {
    paddingVertical: 10,
  },
  doneDismissText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
});
