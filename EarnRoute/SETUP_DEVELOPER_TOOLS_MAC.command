#!/bin/bash
set -euo pipefail
echo "EarnRoute developer-toolchain setup for macOS"
echo "This installs local development tools only; it does not alter the production database."
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew was not found. Install it from https://brew.sh, reopen Terminal and run this script again."
  exit 1
fi
for package in git node openjdk@17 gradle postgresql@16; do
  if brew list --formula "$package" >/dev/null 2>&1; then echo "Already installed: $package"; else brew install "$package"; fi
done
for app in flutter android-studio docker postman; do
  if brew list --cask "$app" >/dev/null 2>&1; then echo "Already installed: $app"; else brew install --cask "$app"; fi
done
BREW_PREFIX="$(brew --prefix)"
JAVA_HOME_PATH="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"
ANDROID_SDK="$HOME/Library/Android/sdk"
touch "$HOME/.zprofile"
if ! grep -q 'EARNROUTE DEV TOOLCHAIN' "$HOME/.zprofile"; then
  cat >> "$HOME/.zprofile" <<'EOF'

# EARNROUTE DEV TOOLCHAIN
export JAVA_HOME="$(brew --prefix openjdk@17)/libexec/openjdk.jdk/Contents/Home"
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$(brew --prefix)/bin:$(brew --prefix openjdk@17)/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
EOF
fi
export JAVA_HOME="$JAVA_HOME_PATH"
export ANDROID_HOME="$ANDROID_SDK"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$BREW_PREFIX/bin:$(brew --prefix openjdk@17)/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
mkdir -p "$ANDROID_HOME"
SDKMANAGER="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
if [ -x "$SDKMANAGER" ]; then
  yes | "$SDKMANAGER" --licenses >/dev/null || true
  "$SDKMANAGER" "platform-tools" "platforms;android-36" "build-tools;36.0.0"
else
  echo "ACTION NEEDED: Android Studio > Settings > Android SDK; install Platform 36, Build-Tools 36.0.0, and Command-line Tools (latest)."
fi
FLUTTER_BIN="$(python3 -c 'import os, shutil; p=shutil.which("flutter"); print(os.path.dirname(os.path.realpath(p)) if p else "")')"
if [ -n "$FLUTTER_BIN" ]; then
  export PATH="$FLUTTER_BIN:$PATH"
  if ! grep -q 'EARNROUTE FLUTTER BIN' "$HOME/.zprofile"; then
    printf '\n# EARNROUTE FLUTTER BIN\nexport PATH="%s:$PATH"\n' "$FLUTTER_BIN" >> "$HOME/.zprofile"
  fi
fi

echo
echo "Versions detected:"
flutter --version
dart --version
java -version
gradle --version
git --version
node --version
npm --version
psql --version || true
pg_dump --version || true
echo
echo "Open Android Studio and finish its first-run wizard."
echo "Then Settings > Plugins > Marketplace > Flutter; accept the Dart plugin prompt."
echo "Run flutter doctor -v and flutter doctor --android-licenses to finish setup."
if ! flutter doctor -v; then echo "Some doctor items still need manual completion; follow the diagnostic output above."; fi
