#!/usr/bin/env bash
set -euo pipefail
unset CDPATH

MOBILE="$(cd "$(dirname "$0")/../.." && pwd)"
mkdir -p "${1:-$MOBILE/build/sidestore}"
OUT="$(cd "${1:-$MOBILE/build/sidestore}" && pwd)"
BUILD_NUMBER="${BUILD_NUMBER:-$(git -C "$MOBILE" rev-list --count HEAD)}"

TMP="$(mktemp -d "$OUT/.Immich-iOS.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

cd "$MOBILE"
flutter build ios --release --no-codesign
APP="$(ls -d "$MOBILE"/build/ios/iphoneos/*.app)"

sign_with_app_group() {
  local bundle="$1"
  local group
  group="$(/usr/libexec/PlistBuddy -c 'Print :AppGroupId' "$bundle/Info.plist")"
  cat > "$TMP/entitlements.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array><string>$group</string></array>
</dict>
</plist>
EOF
  codesign -f -s - --entitlements "$TMP/entitlements.plist" "$bundle"
}

for bundle in "$APP" "$APP"/PlugIns/*.appex; do
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_NUMBER" "$bundle/Info.plist"
done

find "$APP" -depth \( -name '*.framework' -o -name '*.dylib' \) -print0 | xargs -0 -n1 codesign -f -s -
for appex in "$APP"/PlugIns/*.appex; do
  sign_with_app_group "$appex"
done
sign_with_app_group "$APP"
codesign --verify --deep --strict "$APP"

VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Info.plist")"
mkdir "$TMP/Payload"
cp -R "$APP" "$TMP/Payload/"
IPA="$OUT/Immich-iOS-$VERSION-$BUILD_NUMBER.ipa"
(cd "$TMP" && zip -qry package.ipa Payload)
mv -f "$TMP/package.ipa" "$IPA"
echo "$IPA"
