#import "FastArtRust.h"
#import <onnxruntime_objc/onnxruntime_objc.h>
#import <AVFoundation/AVFoundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <UIKit/UIKit.h>
#import <vector>
#include <cstdint>
#include <cstring>
#include <cmath>

static ORTEnv *gModnetOrtEnv;
static ORTSessionOptions *gModnetOrtOptions;
static ORTSession *gModnetOrtSession;
static NSString *gModnetInputName;
static NSString *gModnetOutputName;
static NSLock *gModnetLock;
static NSLock *gVideoDecodeLock;
static NSString *gVideoDecodeUri;
static AVAssetImageGenerator *gVideoImageGenerator;
static NSMutableData *gModnetInputData;

extern "C" {
  bool fastart_ios_prepare_modnet_input(const uint8_t *rgba_ptr, size_t rgba_len, size_t width, size_t height, float *out_ptr, size_t out_len);
  bool fastart_ios_process_modnet_alpha(const float *raw_ptr, size_t raw_len, size_t width, size_t height, float threshold, float feather, uint8_t *out_ptr, size_t out_len);
}

static NSData *FastArtInferModnetAlpha(NSData *rgba, NSInteger width, NSInteger height, float threshold, float feather, NSError **error) {
  if (!gModnetOrtSession || width <= 0 || height <= 0 || rgba.length != (NSUInteger)width * (NSUInteger)height * 4) return nil;
  const size_t plane = 512 * 512;
  const size_t inputBytes = plane * 3 * sizeof(float);
  if (!gModnetInputData || gModnetInputData.length != inputBytes) {
    gModnetInputData = [NSMutableData dataWithLength:inputBytes];
  }
  if (!fastart_ios_prepare_modnet_input((const uint8_t *)rgba.bytes, rgba.length, (size_t)width, (size_t)height,
                                        (float *)gModnetInputData.mutableBytes, plane * 3)) {
    if (error) *error = [NSError errorWithDomain:@"FastArtCutout" code:1 userInfo:@{NSLocalizedDescriptionKey: @"Rust MODNet input preparation failed"}];
    return nil;
  }
  ORTValue *input = [[ORTValue alloc] initWithTensorData:gModnetInputData elementType:ORTTensorElementDataTypeFloat shape:@[@1, @3, @512, @512] error:error];
  if (!input) return nil;
  NSDictionary<NSString *, ORTValue *> *outputs = [gModnetOrtSession runWithInputs:@{gModnetInputName: input} outputNames:[NSSet setWithObject:gModnetOutputName] runOptions:nil error:error];
  ORTValue *matteValue = outputs[gModnetOutputName];
  NSMutableData *matteData = [matteValue tensorDataWithError:error];
  if (!matteData || matteData.length < plane * sizeof(float)) return nil;
  const size_t pixels = (size_t)width * (size_t)height;
  NSMutableData *alpha = [NSMutableData dataWithLength:pixels];
  if (!fastart_ios_process_modnet_alpha((const float *)matteData.bytes, plane, (size_t)width, (size_t)height,
                                        threshold, feather, (uint8_t *)alpha.mutableBytes, pixels)) {
    if (error) *error = [NSError errorWithDomain:@"FastArtCutout" code:2 userInfo:@{NSLocalizedDescriptionKey: @"Rust MODNet alpha processing failed"}];
    return nil;
  }
  return alpha;
}

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

+ (void)load {
  gModnetLock = [NSLock new];
  gVideoDecodeLock = [NSLock new];
}

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
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    [gModnetLock lock];
    @try {
      if (gModnetOrtSession) { resolve(@("ok")); return; }
      NSError *error = nil;
      ORTEnv *env = [[ORTEnv alloc] initWithLoggingLevel:ORTLoggingLevelError error:&error];
      ORTSessionOptions *options = [[ORTSessionOptions alloc] initWithError:&error];
      if (!env || !options) { reject(@"ORT_INIT", error.localizedDescription ?: @"ONNX Runtime initialization failed", error); return; }
      NSURL *modelUrl = [NSURL URLWithString:modelPath];
      NSString *localModelPath = modelUrl.isFileURL ? modelUrl.path : modelPath;
      [options setIntraOpNumThreads:(int)MAX(2, MIN(6, (int)NSProcessInfo.processInfo.activeProcessorCount - 1)) error:nil];
      [options setGraphOptimizationLevel:ORTGraphOptimizationLevelAll error:nil];
      // Core ML schedules compatible graph partitions across CPU, GPU, and ANE.
      // Unsupported nodes stay on ORT's native CPU provider.
      NSError *providerError = nil;
      ORTSessionOptions *sessionOptions = options;
      BOOL coreMLAdded = [options appendExecutionProvider:@"CoreML"
                       providerOptions:@{@"MLComputeUnits": @"ALL", @"ModelFormat": @"MLProgram", @"RequireStaticInputShapes": @"0"}
                                 error:&providerError];
      [options appendExecutionProvider:@"xnnpack" providerOptions:@{@"intra_op_num_threads": @"4"} error:nil];
      ORTSession *session = [[ORTSession alloc] initWithEnv:env modelPath:localModelPath sessionOptions:options error:&error];
      if (!session || !coreMLAdded) {
        // A Core ML provider can be unavailable on a simulator or unsupported OS.
        ORTSessionOptions *cpuOptions = [[ORTSessionOptions alloc] initWithError:&error];
        [cpuOptions setIntraOpNumThreads:(int)MAX(2, MIN(6, (int)NSProcessInfo.processInfo.activeProcessorCount - 1)) error:nil];
        [cpuOptions setGraphOptimizationLevel:ORTGraphOptimizationLevelAll error:nil];
        [cpuOptions appendExecutionProvider:@"xnnpack" providerOptions:@{@"intra_op_num_threads": @"4"} error:nil];
        session = [[ORTSession alloc] initWithEnv:env modelPath:localModelPath sessionOptions:cpuOptions error:&error];
        sessionOptions = cpuOptions;
      }
      NSArray<NSString *> *inputs = [session inputNamesWithError:&error];
      NSArray<NSString *> *outputs = [session outputNamesWithError:&error];
      if (!session || inputs.count == 0 || outputs.count == 0) {
        reject(@"ORT_MODEL", error.localizedDescription ?: @"Could not create MODNet session", error);
        return;
      }
      gModnetOrtEnv = env;
      gModnetOrtOptions = sessionOptions;
      gModnetOrtSession = session;
      gModnetInputName = inputs.firstObject;
      gModnetOutputName = outputs.firstObject;
      resolve(@("ok"));
    } @catch (NSException *exception) {
      reject(@"ORT_INIT", exception.reason ?: @"ONNX Runtime initialization failed", nil);
    } @finally {
      [gModnetLock unlock];
    }
  });
}

RCT_EXPORT_METHOD(inferModnetRgba:(NSString *)rgbaBase64 width:(NSInteger)width height:(NSInteger)height threshold:(double)threshold feather:(double)feather resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    [gModnetLock lock];
    @try {
      const size_t pixelCount = (size_t)width * (size_t)height;
      NSData *rgba = [[NSData alloc] initWithBase64EncodedString:rgbaBase64 options:NSDataBase64DecodingIgnoreUnknownCharacters];
      if (width <= 0 || height <= 0 || rgba.length != pixelCount * 4) { reject(@"INVALID_FRAME", @"Invalid RGBA input for MODNet", nil); return; }
      if (!gModnetOrtSession) { reject(@"ORT_NOT_READY", @"Core ML MODNet session is not initialized", nil); return; }

      NSError *error = nil;
      NSData *alpha = FastArtInferModnetAlpha(rgba, width, height, (float)threshold, (float)feather, &error);
      if (!alpha) { reject(@"ORT_INFERENCE", error.localizedDescription ?: @"MODNet returned invalid output", error); return; }
      resolve([alpha base64EncodedStringWithOptions:0]);
    } @catch (NSException *exception) {
      reject(@"ORT_INFERENCE", exception.reason ?: @"MODNet inference failed", nil);
    } @finally {
      [gModnetLock unlock];
    }
  });
}

RCT_EXPORT_METHOD(processVideoFrameNative:(NSString *)videoUri clipId:(NSString *)clipId frameIdx:(NSInteger)frameIdx timeSeconds:(double)timeSeconds threshold:(double)threshold feather:(double)feather mode:(NSString *)mode keyColor:(NSString *)keyColor resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
    @autoreleasepool {
      NSError *error = nil;
      NSURL *url = [NSURL URLWithString:videoUri];
      if (!url.isFileURL && !url.scheme) url = [NSURL fileURLWithPath:videoUri];
      [gVideoDecodeLock lock];
      if (![gVideoDecodeUri isEqualToString:videoUri] || !gVideoImageGenerator) {
        AVURLAsset *asset = [AVURLAsset URLAssetWithURL:url options:nil];
        gVideoImageGenerator = [[AVAssetImageGenerator alloc] initWithAsset:asset];
        gVideoImageGenerator.appliesPreferredTrackTransform = YES;
        gVideoImageGenerator.maximumSize = CGSizeMake(512, 512);
        gVideoDecodeUri = [videoUri copy];
      }
      CGImageRef image = [gVideoImageGenerator copyCGImageAtTime:CMTimeMakeWithSeconds(MAX(0, timeSeconds), 600) actualTime:nil error:&error];
      [gVideoDecodeLock unlock];
      if (!image) { reject(@"VIDEO_DECODE", error.localizedDescription ?: @"Could not decode video frame", error); return; }

      const size_t width = CGImageGetWidth(image), height = CGImageGetHeight(image), pixels = width * height;
      NSMutableData *rgba = [NSMutableData dataWithLength:pixels * 4];
      CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
      CGContextRef context = CGBitmapContextCreate(rgba.mutableBytes, width, height, 8, width * 4, colorSpace, kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big);
      CGColorSpaceRelease(colorSpace);
      if (!context) { CGImageRelease(image); reject(@"VIDEO_DECODE", @"Could not allocate video frame buffer", nil); return; }
      CGContextDrawImage(context, CGRectMake(0, 0, width, height), image);
      CGContextRelease(context);
      CGImageRelease(image);

      NSData *alpha = nil;
      if ([mode isEqualToString:@"chroma"]) {
        unsigned int color = 0;
        NSScanner *scanner = [NSScanner scannerWithString:[keyColor stringByReplacingOccurrencesOfString:@"#" withString:@""]];
        [scanner scanHexInt:&color];
        NSMutableData *processed = [rgba mutableCopy];
        fastart_ios_process_chroma((uint8_t *)processed.mutableBytes, processed.length, width, height,
                                   (color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff,
                                   (float)threshold, (float)feather, true);
        NSMutableData *chromaAlpha = [NSMutableData dataWithLength:pixels];
        uint8_t *outAlpha = (uint8_t *)chromaAlpha.mutableBytes, *processedBytes = (uint8_t *)processed.mutableBytes;
        for (size_t i = 0; i < pixels; i++) outAlpha[i] = processedBytes[i * 4 + 3];
        alpha = chromaAlpha;
      } else {
        [gModnetLock lock];
        alpha = FastArtInferModnetAlpha(rgba, width, height, (float)threshold, (float)feather, &error);
        [gModnetLock unlock];
      }
      if (!alpha) { reject(@"ORT_INFERENCE", error.localizedDescription ?: @"MODNet inference failed", error); return; }

      NSMutableData *maskPixels = [NSMutableData dataWithLength:pixels * 4];
      uint8_t *mask = (uint8_t *)maskPixels.mutableBytes, *a = (uint8_t *)alpha.bytes;
      for (size_t i = 0; i < pixels; i++) { mask[i*4] = 255; mask[i*4+1] = 255; mask[i*4+2] = 255; mask[i*4+3] = a[i]; }
      CGColorSpaceRef rgb = CGColorSpaceCreateDeviceRGB();
      CGDataProviderRef provider = CGDataProviderCreateWithCFData((__bridge CFDataRef)maskPixels);
      CGImageRef maskImage = CGImageCreate(width, height, 8, 32, width * 4, rgb, kCGImageAlphaLast | kCGBitmapByteOrder32Big, provider, NULL, false, kCGRenderingIntentDefault);
      CGColorSpaceRelease(rgb);
      CGDataProviderRelease(provider);
      if (!maskImage) { reject(@"MASK_ENCODE", @"Could not create mask image", nil); return; }
      NSData *png = UIImagePNGRepresentation([UIImage imageWithCGImage:maskImage]);
      CGImageRelease(maskImage);

      NSString *safeId = [[clipId componentsSeparatedByCharactersInSet:[[NSCharacterSet alphanumericCharacterSet] invertedSet]] componentsJoinedByString:@"_"];
      NSString *directory = [NSTemporaryDirectory() stringByAppendingPathComponent:@"fastart-cutout"];
      [[NSFileManager defaultManager] createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:nil error:nil];
      NSString *path = [directory stringByAppendingPathComponent:[NSString stringWithFormat:@"%@_%ld.png", safeId, (long)frameIdx]];
      if (![png writeToFile:path atomically:NO]) { reject(@"MASK_WRITE", @"Could not save native cutout mask", nil); return; }
      resolve([NSURL fileURLWithPath:path].absoluteString);
    }
  });
}

RCT_EXPORT_METHOD(getVideoFrameInfo:(NSString *)videoUri resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
    NSURL *url = [NSURL URLWithString:videoUri];
    if (!url.isFileURL && !url.scheme) url = [NSURL fileURLWithPath:videoUri];
    AVURLAsset *asset = [AVURLAsset URLAssetWithURL:url options:nil];
    AVAssetTrack *track = [[asset tracksWithMediaType:AVMediaTypeVideo] firstObject];
    const double duration = CMTimeGetSeconds(asset.duration);
    const double frameRate = track.nominalFrameRate;
    if (!track || !isfinite(duration) || duration <= 0 || !isfinite(frameRate) || frameRate <= 0) {
      reject(@"VIDEO_METADATA", @"Could not read source video frame timing", nil);
      return;
    }
    const NSInteger frameCount = (NSInteger)ceil(duration * frameRate);
    resolve(@{@"frameRate": @(frameRate), @"frameCount": @(frameCount), @"duration": @(duration)});
  });
}

RCT_EXPORT_METHOD(releaseVideoCutoutDecoder:(NSString *)videoUri resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject) {
  [gVideoDecodeLock lock];
  if ([gVideoDecodeUri isEqualToString:videoUri]) {
    gVideoImageGenerator = nil;
    gVideoDecodeUri = nil;
  }
  [gVideoDecodeLock unlock];
  resolve(nil);
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
