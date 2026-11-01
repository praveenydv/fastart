#import "FastArtRust.h"
#import <vector>

// Forward declaration of C-FFI functions from libfastart_ios.a
extern "C" {
  bool fastart_ios_init(void);
  char* fastart_ios_detect_beats(const float* samples_ptr, size_t count, uint32_t sample_rate);
  size_t fastart_ios_generate_waveform(const float* samples_ptr, size_t count, size_t buckets, float* out_peaks_ptr);
  uint8_t* fastart_ios_render_snapshot(const char* project_json_ptr, double time_sec, uint32_t width, uint32_t height, size_t* out_len);
  uint8_t* fastart_ios_render_frame_rgba(const char* project_json_ptr, double time_sec, uint32_t width, uint32_t height, size_t* out_len);
  uint8_t* fastart_ios_export_gif(const char* project_json_ptr, uint32_t fps, uint32_t width, uint32_t height, double duration, size_t* out_len);
  uint8_t* fastart_ios_export_wav(const char* project_json_ptr, uint32_t sample_rate, double duration, size_t* out_len);
  uint8_t* fastart_ios_export_mp4(const char* project_json_ptr, uint32_t fps, uint32_t width, uint32_t height, double duration, size_t* out_len);
  bool fastart_ios_export_mp4_file(const char* project_json_ptr, uint32_t fps, uint32_t width, uint32_t height, double duration, const char* output_path_ptr);
  bool fastart_ios_export_gif_file(const char* project_json_ptr, uint32_t fps, uint32_t width, uint32_t height, double duration, const char* output_path_ptr);
  bool fastart_ios_export_wav_file(const char* project_json_ptr, uint32_t sample_rate, double duration, const char* output_path_ptr);
  void fastart_ios_free_string(char* ptr);
  void fastart_ios_free_bytes(uint8_t* ptr, size_t len);
}

@implementation FastArtRust

RCT_EXPORT_MODULE(FastArtRust);

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

RCT_EXPORT_METHOD(isAvailable:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  @try {
    BOOL ready = fastart_ios_init();
    resolve(@(ready));
  } @catch (NSException *exception) {
    resolve(@(NO));
  }
}

RCT_EXPORT_METHOD(detectBeats:(NSArray *)samplesArray sampleRate:(NSInteger)sampleRate resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSUInteger count = samplesArray.count;
    std::vector<float> samples(count);
    for (NSUInteger i = 0; i < count; i++) {
      samples[i] = [samplesArray[i] floatValue];
    }
    char* jsonStr = fastart_ios_detect_beats(samples.data(), count, (uint32_t)sampleRate);
    if (jsonStr) {
      NSString* result = [NSString stringWithUTF8String:jsonStr];
      fastart_ios_free_string(jsonStr);
      resolve(result);
    } else {
      resolve(@"{}");
    }
  });
}

RCT_EXPORT_METHOD(generateWaveform:(NSArray *)samplesArray buckets:(NSInteger)buckets resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSUInteger count = samplesArray.count;
    std::vector<float> samples(count);
    for (NSUInteger i = 0; i < count; i++) {
      samples[i] = [samplesArray[i] floatValue];
    }
    std::vector<float> peaks(buckets);
    size_t peakCount = fastart_ios_generate_waveform(samples.data(), count, (size_t)buckets, peaks.data());
    NSMutableArray* peaksArray = [NSMutableArray arrayWithCapacity:peakCount];
    for (size_t i = 0; i < peakCount; i++) {
      [peaksArray addObject:@(peaks[i])];
    }
    resolve(peaksArray);
  });
}

RCT_EXPORT_METHOD(renderSnapshot:(NSString *)projectJson timeSec:(double)timeSec width:(NSInteger)width height:(NSInteger)height resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    const char* cJson = [projectJson UTF8String];
    size_t outLen = 0;
    uint8_t* pngBytes = fastart_ios_render_snapshot(cJson, timeSec, (uint32_t)width, (uint32_t)height, &outLen);
    if (pngBytes && outLen > 0) {
      NSData* data = [NSData dataWithBytesNoCopy:pngBytes length:outLen freeWhenDone:NO];
      NSString* base64 = [data base64EncodedStringWithOptions:0];
      fastart_ios_free_bytes(pngBytes, outLen);
      resolve([NSString stringWithFormat:@"data:image/png;base64,%@", base64]);
    } else {
      reject(@"RENDER_ERROR", @"Failed to render snapshot in Rust iOS core", nil);
    }
  });
}

RCT_EXPORT_METHOD(renderFrameRgba:(NSString *)projectJson timeSec:(double)timeSec width:(NSInteger)width height:(NSInteger)height resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    const char* cJson = [projectJson UTF8String];
    size_t outLen = 0;
    uint8_t* rgbaBytes = fastart_ios_render_frame_rgba(cJson, timeSec, (uint32_t)width, (uint32_t)height, &outLen);
    if (rgbaBytes && outLen > 0) {
      NSMutableArray* arr = [NSMutableArray arrayWithCapacity:outLen];
      for (size_t i = 0; i < outLen; i++) {
        [arr addObject:@(rgbaBytes[i])];
      }
      fastart_ios_free_bytes(rgbaBytes, outLen);
      resolve(arr);
    } else {
      reject(@"FRAME_ERROR", @"Failed to render RGBA frame in Rust iOS core", nil);
    }
  });
}

RCT_EXPORT_METHOD(exportGif:(NSString *)projectJson fps:(NSInteger)fps width:(NSInteger)width height:(NSInteger)height duration:(double)duration targetPath:(NSString *)targetPath resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSString* destPath = targetPath;
    if (!destPath || [destPath length] == 0) {
      destPath = [NSTemporaryDirectory() stringByAppendingPathComponent:[NSString stringWithFormat:@"fastart_export_%@.gif", [[NSUUID UUID] UUIDString]]];
    } else if ([destPath hasPrefix:@"file://"]) {
      destPath = [destPath substringFromIndex:7];
    }

    const char* cJson = [projectJson UTF8String];
    const char* cPath = [destPath UTF8String];
    bool ok = fastart_ios_export_gif_file(cJson, (uint32_t)fps, (uint32_t)width, (uint32_t)height, duration, cPath);
    if (ok) {
      resolve(destPath);
    } else {
      reject(@"GIF_ERROR", @"Failed to export GIF in Rust iOS core", nil);
    }
  });
}

RCT_EXPORT_METHOD(exportWav:(NSString *)projectJson sampleRate:(NSInteger)sampleRate duration:(double)duration targetPath:(NSString *)targetPath resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSString* destPath = targetPath;
    if (!destPath || [destPath length] == 0) {
      destPath = [NSTemporaryDirectory() stringByAppendingPathComponent:[NSString stringWithFormat:@"fastart_export_%@.wav", [[NSUUID UUID] UUIDString]]];
    } else if ([destPath hasPrefix:@"file://"]) {
      destPath = [destPath substringFromIndex:7];
    }

    const char* cJson = [projectJson UTF8String];
    const char* cPath = [destPath UTF8String];
    bool ok = fastart_ios_export_wav_file(cJson, (uint32_t)sampleRate, duration, cPath);
    if (ok) {
      resolve(destPath);
    } else {
      reject(@"WAV_ERROR", @"Failed to export WAV in Rust iOS core", nil);
    }
  });
}

RCT_EXPORT_METHOD(exportMp4:(NSString *)projectJson fps:(NSInteger)fps width:(NSInteger)width height:(NSInteger)height duration:(double)duration targetPath:(NSString *)targetPath resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSString* destPath = targetPath;
    if (!destPath || [destPath length] == 0) {
      destPath = [NSTemporaryDirectory() stringByAppendingPathComponent:[NSString stringWithFormat:@"fastart_export_%@.mp4", [[NSUUID UUID] UUIDString]]];
    } else if ([destPath hasPrefix:@"file://"]) {
      destPath = [destPath substringFromIndex:7];
    }

    const char* cJson = [projectJson UTF8String];
    const char* cPath = [destPath UTF8String];
    bool ok = fastart_ios_export_mp4_file(cJson, (uint32_t)fps, (uint32_t)width, (uint32_t)height, duration, cPath);
    if (ok) {
      resolve(destPath);
    } else {
      reject(@"MP4_ERROR", @"Failed to export MP4 in Rust iOS core", nil);
    }
  });
}

@end
