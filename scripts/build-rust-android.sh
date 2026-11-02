#!/bin/sh
set -eu

TARGET="aarch64-linux-android"
ANDROID_API="24"
SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
NDK_ROOT="${ANDROID_NDK_HOME:-}"

if [ -z "$SDK_ROOT" ] && [ -f android/local.properties ]; then
  SDK_ROOT="$(sed -n 's/^sdk\.dir=//p' android/local.properties | head -n 1 | sed 's/\\\\/\\/g; s/\\:/\:/g')"
fi

if [ -z "$SDK_ROOT" ] && [ -n "${HOME:-}" ]; then
  if [ -d "$HOME/Library/Android/sdk" ]; then
    SDK_ROOT="$HOME/Library/Android/sdk"
  elif [ -d "$HOME/Android/Sdk" ]; then
    SDK_ROOT="$HOME/Android/Sdk"
  fi
fi

if [ -z "$NDK_ROOT" ]; then
  if [ -z "$SDK_ROOT" ]; then
    echo "Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT." >&2
    exit 1
  fi
  for CANDIDATE_NDK in "$SDK_ROOT"/ndk/*; do
    if [ -d "$CANDIDATE_NDK" ]; then
      NDK_ROOT="$CANDIDATE_NDK"
    fi
  done
  if [ -z "$NDK_ROOT" ]; then
    echo "Android NDK not found under $SDK_ROOT/ndk. Set ANDROID_NDK_HOME." >&2
    exit 1
  fi
fi

NDK_HOST_TAG="darwin-x86_64"
if [ "$(uname -s)" = "Linux" ]; then
  NDK_HOST_TAG="linux-x86_64"
fi
LINKER="$NDK_ROOT/toolchains/llvm/prebuilt/$NDK_HOST_TAG/bin/aarch64-linux-android${ANDROID_API}-clang"

if [ ! -x "$LINKER" ]; then
  echo "Android NDK linker not found: $LINKER" >&2
  exit 1
fi

rustup target add "$TARGET"
CC_aarch64_linux_android="$LINKER" \
AR_aarch64_linux_android="$NDK_ROOT/toolchains/llvm/prebuilt/$NDK_HOST_TAG/bin/llvm-ar" \
CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER="$LINKER" \
  cargo build --manifest-path rust/Cargo.toml --target "$TARGET" --release --package fastart_jni

LIBRARY="rust/target/$TARGET/release/libfastart_jni.so"
if [ ! -f "$LIBRARY" ]; then
  echo "Android Rust library was not produced: $LIBRARY" >&2
  exit 1
fi

DESTINATION="modules/fastart-rust/android/src/main/jniLibs/arm64-v8a"
mkdir -p "$DESTINATION"
cp "$LIBRARY" "$DESTINATION/libfastart_jni.so"
