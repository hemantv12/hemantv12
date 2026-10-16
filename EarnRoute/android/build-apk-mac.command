#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
"$ROOT/sync-assets.sh"
GRADLE_VERSION="9.8.1"
GRADLE_HOME_DIR="${HOME}/.cache/earnroute/gradle-${GRADLE_VERSION}"
SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-${HOME}/Library/Android/sdk}}"

fail() { echo; echo "EarnRoute APK build stopped: $*"; echo; read -r -p "Press Enter to close..." _ || true; exit 1; }
command -v java >/dev/null 2>&1 || fail "Java is not installed. Install Android Studio (which includes a compatible JDK) and retry."

[ -d "$SDK_ROOT/platforms/android-36" ] || {
  echo "Android SDK Platform 37 was not found at: $SDK_ROOT"
  echo "Open Android Studio → Settings/Preferences → Android SDK and install Android SDK Platform 37."
  fail "Android SDK Platform 37 is required."
}
[ -d "$SDK_ROOT/build-tools/36.0.0" ] || {
  echo "Android SDK Build-Tools 36.0.0 were not found at: $SDK_ROOT"
  echo "Open Android Studio → Settings/Preferences → Android SDK → SDK Tools and install Android SDK Build-Tools 36.0.0."
  fail "Android Build-Tools 36.0.0 are required."
}

if [ ! -x "${GRADLE_HOME_DIR}/bin/gradle" ]; then
  command -v curl >/dev/null 2>&1 || fail "curl is required to download Gradle."
  command -v unzip >/dev/null 2>&1 || fail "unzip is required to install Gradle."
  mkdir -p "${HOME}/.cache/earnroute/downloads"
  ZIP="${HOME}/.cache/earnroute/downloads/gradle-${GRADLE_VERSION}-bin.zip"
  URL="https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip"
  echo "Downloading Gradle ${GRADLE_VERSION} from the official Gradle distribution host..."
  curl --fail --location --silent --show-error "$URL" -o "$ZIP" || fail "Gradle download failed. Check your internet connection."
  curl --fail --location --silent --show-error "${URL}.sha256" -o "${ZIP}.sha256" || fail "Could not retrieve Gradle's official SHA-256 checksum."
  EXPECTED="$(awk '{print $1}' "${ZIP}.sha256")"
  ACTUAL="$(shasum -a 256 "$ZIP" | awk '{print $1}')"
  [ -n "$EXPECTED" ] && [ "$EXPECTED" = "$ACTUAL" ] || fail "Gradle checksum verification failed; the archive will not be used."
  mkdir -p "${GRADLE_HOME_DIR}"
  unzip -q "$ZIP" -d "${HOME}/.cache/earnroute/"
  mv "${HOME}/.cache/earnroute/gradle-${GRADLE_VERSION}" "${GRADLE_HOME_DIR}" 2>/dev/null || true
fi

GRADLE="${GRADLE_HOME_DIR}/bin/gradle"
[ -x "$GRADLE" ] || fail "Gradle was not installed correctly."
echo "Building EarnRoute debug APK..."
"$GRADLE" -p "$ROOT" assembleDebug
APK="$ROOT/app/build/outputs/apk/debug/app-debug.apk"
[ -f "$APK" ] || fail "Gradle finished but the expected APK was not produced."
echo
echo "APK built successfully: $APK"
echo "This debug APK still requires a deployed HTTPS EarnRoute backend."
read -r -p "Press Enter to close..." _ || true
