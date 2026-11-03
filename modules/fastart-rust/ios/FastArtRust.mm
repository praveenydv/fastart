#import "FastArtRust.h"
#import <vector>
#include <cstdint>
#include <cstring>

// Forward declaration of C-FFI functions from libfastart_ios.a
extern "C" {
  bool fastart_ios_init(void);
  char* fastart_ios_generate_animation_keyframes(const char* preset, const char* category, size_t frames);
  bool fastart_ios_initialize_modnet(const char* path);
  bool fastart_ios_infer_modnet_rgba(const uint8_t* rgba_ptr, size_t rgba_len, size_t width, size_t height, float threshold, float feather, uint8_t* out_ptr, size_t out_len);
  bool fastart_ios_process_chroma(uint8_t* rgba_ptr, size_t rgba_len, size_t width, size_t height, uint8_t r, uint8_t g, uint8_t b, float threshold, float feather, bool despill);
  bool fastart_ios_segment_frame_rgba(const uint8_t* rgba_ptr, size_t rgba_len, size_t width, size_t height, float threshold, float feather, uint8_t* out_alpha_ptr, size_t out_alpha_len);
  size_t fastart_ios_pack_alpha_rle(const uint8_t* alpha_ptr, size_t alpha_len, uint8_t* out_ptr, size_t out_capacity);
  size_t fastart_ios_unpack_alpha_rle(const uint8_t* rle_ptr, size_t rle_len, uint8_t* out_ptr, size_t out_len);
  uint8_t* fastart_ios_encode_rgba_png(const uint8_t* rgba_ptr, size_t rgba_len, size_t width, size_t height, size_t* out_len);
  void fastart_ios_free_bytes(uint8_t* ptr, size_t len);
  char* fastart_ios_detect_beats(const float* samples_ptr, size_t count, uint32_t sample_rate);
  size_t fastart_ios_generate_waveform(const float* samples_ptr, size_t count, size_t buckets, float* out_peaks_ptr);
  bool fastart_ios_denoise_waveform_peaks(float* peaks_ptr, size_t count);
  char* fastart_ios_decode_audio_peaks(const uint8_t* data_ptr, size_t data_len, size_t num_points);
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

RCT_EXPORT_METHOD(generateAnimationKeyframes:(NSString *)preset category:(NSString *)category frames:(NSInteger)frames resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    const char *presetBytes = [preset UTF8String];
    const char *categoryBytes = [category UTF8String];
    char *json = fastart_ios_generate_animation_keyframes(presetBytes, categoryBytes, (size_t)MAX(2, MIN(240, frames)));
    if (!json) {
      reject(@"RUST_PROCESSING_ERROR", @"Rust animation keyframe generation failed", nil);
      return;
    }
    NSString *result = [NSString stringWithUTF8String:json];
    fastart_ios_free_string(json);
    resolve(result ?: @"{\"frames\":[]}");
  });
}

RCT_EXPORT_METHOD(initializeModnet:(NSString *)modelPath resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  const char *path = [modelPath UTF8String];
  resolve(@(path && fastart_ios_initialize_modnet(path)));
}

RCT_EXPORT_METHOD(inferModnetRgba:(NSString *)rgbaBase64 width:(NSInteger)width height:(NSInteger)height threshold:(double)threshold feather:(double)feather resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSData *rgbaData = [[NSData alloc] initWithBase64EncodedString:rgbaBase64 options:NSDataBase64DecodingIgnoreUnknownCharacters];
    const size_t rgbaCount = (size_t)width * (size_t)height * 4;
    if (width <= 0 || height <= 0 || rgbaData.length != rgbaCount) { reject(@"INVALID_FRAME", @"Invalid RGBA input for MODNet", nil); return; }
    std::vector<uint8_t> rgba((const uint8_t *)rgbaData.bytes, (const uint8_t *)rgbaData.bytes + rgbaCount), alpha((NSUInteger)width * (NSUInteger)height);
    if (!fastart_ios_infer_modnet_rgba(rgba.data(), rgba.size(), width, height, (float)threshold, (float)feather, alpha.data(), alpha.size())) { reject(@"RUST_PROCESSING_ERROR", @"Rust MODNet inference failed", nil); return; }
    NSData *result = [NSData dataWithBytes:alpha.data() length:alpha.size()];
    resolve([result base64EncodedStringWithOptions:0]);
  });
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

RCT_EXPORT_METHOD(denoiseWaveformPeaks:(NSArray *)peaksArray resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    std::vector<float> peaks(peaksArray.count);
    for (NSUInteger i = 0; i < peaks.size(); i++) peaks[i] = [peaksArray[i] floatValue];
    if (!fastart_ios_denoise_waveform_peaks(peaks.data(), peaks.size())) {
      reject(@"RUST_PROCESSING_ERROR", @"Rust waveform denoising failed", nil);
      return;
    }
    NSMutableArray *result = [NSMutableArray arrayWithCapacity:peaks.size()];
    for (float value : peaks) [result addObject:@(value)];
    resolve(result);
  });
}

RCT_EXPORT_METHOD(decodeAudioPeaks:(NSString *)dataBase64 numPoints:(NSInteger)numPoints resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSData *data = [[NSData alloc] initWithBase64EncodedString:dataBase64 options:NSDataBase64DecodingIgnoreUnknownCharacters];
    if (!data || data.length == 0) {
      reject(@"INVALID_AUDIO", @"Invalid base64 WAV data", nil);
      return;
    }
    char *json = fastart_ios_decode_audio_peaks((const uint8_t *)data.bytes, data.length, (size_t)MAX(1, numPoints));
    if (!json) {
      // Unsupported containers/codecs or absent audio tracks simply have no
      // waveform. Resolve null so media probing remains a normal no-result case.
      resolve([NSNull null]);
      return;
    }
    NSString *result = [NSString stringWithUTF8String:json];
    fastart_ios_free_string(json);
    resolve(result ?: @"");
  });
}

RCT_EXPORT_METHOD(processChromaCutout:(NSString *)rgbaBase64 width:(NSInteger)width height:(NSInteger)height rgb:(NSInteger)rgb threshold:(double)threshold feather:(double)feather despill:(BOOL)despill resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    const size_t expected = (size_t)width * (size_t)height * 4;
    NSData *rgbaData = [[NSData alloc] initWithBase64EncodedString:rgbaBase64 options:NSDataBase64DecodingIgnoreUnknownCharacters];
    if (width <= 0 || height <= 0 || rgbaData.length != expected) {
      reject(@"INVALID_FRAME", @"Invalid RGBA frame for Rust chroma processing", nil);
      return;
    }
    std::vector<uint8_t> rgba((const uint8_t *)rgbaData.bytes, (const uint8_t *)rgbaData.bytes + expected);
    const uint8_t red = (uint8_t)((rgb >> 16) & 0xFF);
    const uint8_t green = (uint8_t)((rgb >> 8) & 0xFF);
    const uint8_t blue = (uint8_t)(rgb & 0xFF);
    const bool ok = fastart_ios_process_chroma(rgba.data(), rgba.size(), width, height,
      red, green, blue, (float)threshold, (float)feather, despill);
    if (!ok) {
      reject(@"RUST_PROCESSING_ERROR", @"Rust chroma processing failed", nil);
      return;
    }
    NSData *result = [NSData dataWithBytes:rgba.data() length:rgba.size()];
    resolve([result base64EncodedStringWithOptions:0]);
  });
}

RCT_EXPORT_METHOD(segmentFrameRgba:(NSString *)rgbaBase64 width:(NSInteger)width height:(NSInteger)height threshold:(double)threshold feather:(double)feather resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    if (width <= 0 || height <= 0 || (uint64_t)width > SIZE_MAX / 4 / (uint64_t)height) {
      reject(@"INVALID_FRAME", @"Invalid RGBA frame dimensions", nil);
      return;
    }
    const size_t pixelCount = (size_t)width * (size_t)height;
    const size_t rgbaCount = pixelCount * 4;
    NSData *rgbaData = [[NSData alloc] initWithBase64EncodedString:rgbaBase64 options:NSDataBase64DecodingIgnoreUnknownCharacters];
    if (rgbaData == nil || rgbaData.length != rgbaCount) {
      reject(@"INVALID_FRAME", @"Invalid RGBA frame for Rust segmentation", nil);
      return;
    }
    std::vector<uint8_t> rgba(rgbaCount);
    std::vector<uint8_t> alpha(pixelCount);
    memcpy(rgba.data(), rgbaData.bytes, rgbaCount);
    const bool ok = fastart_ios_segment_frame_rgba(rgba.data(), rgba.size(), width, height,
      (float)threshold, (float)feather, alpha.data(), alpha.size());
    if (!ok) {
      reject(@"RUST_PROCESSING_ERROR", @"Rust segmentation failed", nil);
      return;
    }
    NSData *alphaData = [NSData dataWithBytes:alpha.data() length:alpha.size()];
    resolve([alphaData base64EncodedStringWithOptions:0]);
  });
}

RCT_EXPORT_METHOD(packAlphaRLE:(NSString *)alphaBase64 resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSData *alphaData = [[NSData alloc] initWithBase64EncodedString:alphaBase64 options:NSDataBase64DecodingIgnoreUnknownCharacters];
    if (!alphaData) { reject(@"INVALID_MASK", @"Invalid alpha data for Rust compression", nil); return; }
    std::vector<uint8_t> alpha((const uint8_t *)alphaData.bytes, (const uint8_t *)alphaData.bytes + alphaData.length);
    std::vector<uint8_t> encoded(alpha.size() * 2);
    size_t written = fastart_ios_pack_alpha_rle(alpha.data(), alpha.size(), encoded.data(), encoded.size());
    if (written == 0 && !alpha.empty()) {
      reject(@"RUST_PROCESSING_ERROR", @"Rust alpha compression failed", nil);
      return;
    }
    NSData *result = [NSData dataWithBytes:encoded.data() length:written];
    resolve([result base64EncodedStringWithOptions:0]);
  });
}

RCT_EXPORT_METHOD(unpackAlphaRLE:(NSArray *)rleArray outputLength:(NSInteger)outputLength resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    if (outputLength <= 0) {
      reject(@"INVALID_LENGTH", @"Invalid Rust alpha output length", nil);
      return;
    }
    std::vector<uint8_t> rle(rleArray.count);
    std::vector<uint8_t> alpha((size_t)outputLength);
    for (size_t i = 0; i < rle.size(); i++) rle[i] = (uint8_t)[rleArray[i] unsignedCharValue];
    size_t written = fastart_ios_unpack_alpha_rle(rle.data(), rle.size(), alpha.data(), alpha.size());
    if (written != alpha.size()) {
      reject(@"RUST_PROCESSING_ERROR", @"Rust alpha decompression failed", nil);
      return;
    }
    NSMutableArray *result = [NSMutableArray arrayWithCapacity:written];
    for (size_t i = 0; i < written; i++) [result addObject:@(alpha[i])];
    resolve(result);
  });
}

RCT_EXPORT_METHOD(encodeRgbaPng:(NSString *)rgbaBase64 width:(NSInteger)width height:(NSInteger)height resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    const size_t expected = (size_t)width * (size_t)height * 4;
    NSData *rgbaData = [[NSData alloc] initWithBase64EncodedString:rgbaBase64 options:NSDataBase64DecodingIgnoreUnknownCharacters];
    if (width <= 0 || height <= 0 || rgbaData.length != expected) {
      reject(@"INVALID_FRAME", @"Invalid RGBA frame for Rust PNG encoding", nil);
      return;
    }
    std::vector<uint8_t> rgba((const uint8_t *)rgbaData.bytes, (const uint8_t *)rgbaData.bytes + expected);
    size_t pngLen = 0;
    uint8_t* png = fastart_ios_encode_rgba_png(rgba.data(), rgba.size(), width, height, &pngLen);
    if (!png || pngLen == 0) {
      reject(@"RUST_ENCODING_ERROR", @"Rust PNG encoding failed", nil);
      return;
    }
    NSData *result = [NSData dataWithBytes:png length:pngLen];
    fastart_ios_free_bytes(png, pngLen);
    resolve([result base64EncodedStringWithOptions:0]);
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
