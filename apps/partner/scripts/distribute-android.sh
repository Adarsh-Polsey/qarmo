#!/usr/bin/env bash
# Build a release Android APK locally (gradle) and ship it to Firebase App Distribution.
#
# Usage:
#   ./scripts/distribute-android.sh                # gradle assembleRelease, then distribute
#   ./scripts/distribute-android.sh ./path/app.apk # distribute an existing APK, skip the build
#
# Env overrides:
#   FAD_GROUPS   tester group alias(es), comma-separated   (default: "internal")
#   FAD_TESTERS  tester email(s), comma-separated           (default: none)
#   FAD_NOTES    release notes                              (default: "Internal build <timestamp>")
#
# Requires: ANDROID_SDK_ROOT (or android/local.properties) for gradle, and Firebase auth via
#   `firebase login`  or  GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
#   (service account needs the "Firebase App Distribution Admin" role).
set -euo pipefail

# Run from the app project root (where app.json / android/ live) regardless of CWD.
cd "$(dirname "$0")/.."

# Firebase App Distribution target — pulled from google-services.json (mobilesdk_app_id).
FIREBASE_APP_ID="1:137124836254:android:c20cc7fe30f87706d31c8f"

GROUPS="${FAD_GROUPS:-internal}"
TESTERS="${FAD_TESTERS:-}"
NOTES="${FAD_NOTES:-Internal build $(date '+%Y-%m-%d %H:%M')}"
FIREBASE="npx --yes firebase-tools"

APK="${1:-}"
DEFAULT_APK="android/app/build/outputs/apk/release/app-release.apk"

if [ -z "$APK" ]; then
  echo "▶ Building release APK (gradle assembleRelease)…"
  ( cd android && ./gradlew assembleRelease --console=plain )
  APK="$DEFAULT_APK"
fi

[ -f "$APK" ] || { echo "✗ APK not found: $APK" >&2; exit 1; }

echo "▶ Distributing $APK to Firebase App Distribution…"
DIST_ARGS=(--app "$FIREBASE_APP_ID" --release-notes "$NOTES")
[ -n "$GROUPS" ]  && DIST_ARGS+=(--groups "$GROUPS")
[ -n "$TESTERS" ] && DIST_ARGS+=(--testers "$TESTERS")

$FIREBASE appdistribution:distribute "$APK" "${DIST_ARGS[@]}"

echo "✓ Distributed to Firebase App Distribution (groups: ${GROUPS:-none}, testers: ${TESTERS:-none})."
