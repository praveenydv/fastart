import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { soundEngine } from '../../utils/audioEngine';
import { VideoClip } from '../../types/project';

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onAddRecordedClip: (clip: VideoClip) => void;
}

export default function CameraModal({
  visible,
  onClose,
  onAddRecordedClip,
}: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [recordTimer, setRecordTimer] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const timerIntervalRef = useRef<any>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Initialize camera stream
  useEffect(() => {
    if (visible && Platform.OS === 'web') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [visible, facingMode]);

  const startCamera = async () => {
    setCameraError(null);
    setRecordedBlobUrl(null);
    setIsRecording(false);
    setRecordTimer(0);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Live browser camera unsupported. Tap "Open Device Camera" to record directly.');
      return;
    }

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Try with ideal facingMode and audio
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: true,
        });
      } catch (audioErr) {
        // Fallback to video only if audio permission is rejected on mobile
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false,
        });
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.muted = true;
        videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Camera error:', err);
      setCameraError('Camera access blocked. Tap "Open Device Camera" below to use your phone camera.');
    }
  };

  // 100% reliable native phone camera capture
  const handleNativeDeviceCamera = async () => {
    try {
      soundEngine.playSfx('click');
      if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*,image/*';
        input.setAttribute('capture', facingMode === 'user' ? 'user' : 'environment');
        input.onchange = (e: any) => {
          const file = e.target.files?.[0];
          if (file) {
            const url = URL.createObjectURL(file);
            const isVideo = file.type.startsWith('video');
            const clip: VideoClip = {
              id: 'clip-rec-' + Date.now(),
              title: `Camera Capture ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
              type: isVideo ? 'video' : 'photo',
              url,
              duration: isVideo ? 5.0 : 4.0,
              startTime: 0,
              filter: 'normal',
              volume: 1.0,
              transform: { scale: 1, rotation: 0, x: 0, y: 0 },
            };
            onAddRecordedClip(clip);
            onClose();
          }
        };
        input.click();
      } else {
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          allowsEditing: false,
          quality: 1,
        });
        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          const clip: VideoClip = {
            id: 'clip-rec-' + Date.now(),
            title: `Camera Capture ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
            type: 'video',
            url: asset.uri,
            duration: asset.duration ? asset.duration / 1000 : 5.0,
            startTime: 0,
            filter: 'normal',
            volume: 1.0,
            transform: { scale: 1, rotation: 0, x: 0, y: 0 },
          };
          onAddRecordedClip(clip);
          onClose();
        }
      }
    } catch (err) {
      console.warn('Native camera error:', err);
    }
  };

  const stopCamera = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];
    soundEngine.playSfx('whoosh');

    try {
      const mimeType = (window as any).MediaRecorder?.isTypeSupported?.('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : (window as any).MediaRecorder?.isTypeSupported?.('video/mp4')
        ? 'video/mp4'
        : 'video/webm';

      const recorder = new (window as any).MediaRecorder(streamRef.current, { mimeType });
      recorder.ondataavailable = (e: any) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedBlobUrl(url);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordTimer(0);

      const startTime = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setRecordTimer(elapsed);
        setRecordedDuration(elapsed);
      }, 100);
    } catch (err) {
      console.error('Failed to start recorder:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      soundEngine.playSfx('pop');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const handleFlipCamera = () => {
    soundEngine.playSfx('click');
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const handleAddToTimeline = () => {
    if (!recordedBlobUrl) return;
    soundEngine.playSfx('whoosh');

    const newClip: VideoClip = {
      id: 'clip-rec-' + Date.now(),
      title: `Camera Recording ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      type: 'video',
      url: recordedBlobUrl,
      duration: Math.max(1.0, parseFloat(recordedDuration.toFixed(1))),
      startTime: 0,
      filter: 'normal',
      volume: 1.0,
      transform: { scale: 1, rotation: 0, x: 0, y: 0 },
    };

    onAddRecordedClip(newClip);
    onClose();
  };

  const formatSecs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.topIconBtn}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.recordBadge}>
            <View style={[styles.redDot, isRecording && styles.redDotActive]} />
            <Text style={styles.timerText}>{formatSecs(recordTimer)}</Text>
          </View>

          <TouchableOpacity onPress={handleFlipCamera} style={styles.topIconBtn}>
            <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Viewfinder View */}
        <View style={styles.viewfinderWrapper}>
          {cameraError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={48} color="#FF0050" />
              <Text style={styles.errorTitle}>Camera Unavailable</Text>
              <Text style={styles.errorSubtitle}>{cameraError}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={startCamera}>
                <Text style={styles.retryBtnText}>Retry Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.nativeCameraBtn} onPress={handleNativeDeviceCamera} activeOpacity={0.8}>
                <Ionicons name="camera" size={18} color="#000000" />
                <Text style={styles.nativeCameraBtnText}>Open Phone Camera App</Text>
              </TouchableOpacity>
            </View>
          ) : recordedBlobUrl ? (
            // Recorded Video Preview
            <View style={styles.previewContainer}>
              <video
                src={recordedBlobUrl}
                controls
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: 12,
                }}
              />
            </View>
          ) : (
            // Live Stream
            <View style={styles.liveStreamContainer}>
              {Platform.OS === 'web' && (
                <video
                  ref={videoRef as any}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                    borderRadius: 16,
                  }}
                />
              )}
            </View>
          )}
        </View>

        {/* Bottom Shutter & Controls */}
        <View style={styles.bottomBar}>
          {recordedBlobUrl ? (
            <View style={styles.reviewButtonsRow}>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => {
                  soundEngine.playSfx('click');
                  setRecordedBlobUrl(null);
                  startCamera();
                }}
              >
                <Ionicons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.retakeText}>Retake</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.addBtn} onPress={handleAddToTimeline}>
                <Ionicons name="checkmark-circle" size={22} color="#000000" />
                <Text style={styles.addBtnText}>Add to Project</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.shutterRow}>
              <TouchableOpacity
                style={[styles.shutterOuter, isRecording && styles.shutterOuterRecording]}
                onPress={isRecording ? stopRecording : startRecording}
                activeOpacity={0.8}
              >
                <View
                  style={[styles.shutterInner, isRecording && styles.shutterInnerRecording]}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'space-between',
  },
  topBar: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 10,
  },
  topIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 8,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF0050',
  },
  redDotActive: {
    backgroundColor: '#FF0050',
    transform: [{ scale: 1.2 }],
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  viewfinderWrapper: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liveStreamContainer: {
    width: '100%',
    height: '100%',
    maxWidth: 500,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#11141D',
  },
  previewContainer: {
    width: '100%',
    height: '100%',
    maxWidth: 500,
    borderRadius: 16,
    overflow: 'hidden',
  },
  errorBox: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#1E2333',
    borderRadius: 16,
    maxWidth: 360,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  errorSubtitle: {
    color: '#8E95A5',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  retryBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  nativeCameraBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00F2FE',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 22,
    gap: 8,
    marginTop: 12,
  },
  nativeCameraBtnText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  bottomBar: {
    height: 110,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  shutterRow: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterOuter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  shutterOuterRecording: {
    borderColor: '#FF0050',
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FF0050',
  },
  shutterInnerRecording: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#FF0050',
  },
  reviewButtonsRow: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  retakeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#202637',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  retakeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  addBtn: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00F2FE',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
  },
});
