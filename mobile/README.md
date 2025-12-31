# Ketone Mobile

Native iOS and Android app built with Ionic/Vue + Capacitor.

## Prerequisites

- [Bun](https://bun.sh/) installed
- [Android Studio](https://developer.android.com/studio) for Android development
- [Xcode](https://developer.apple.com/xcode/) for iOS development (macOS only)
- [CocoaPods](https://cocoapods.org/) for iOS dependencies (`brew install cocoapods`)

## Setup

```bash
# From the project root
bun install

# Build the web assets
cd mobile
bun run build
```

## Android Development

### First-time setup

1. Open Android Studio
2. Open the project: `mobile/android`
3. Let Gradle sync complete
4. Create an emulator in **Tools > Device Manager**

### Running the app

```bash
# Build, sync, and set up port forwarding
cd mobile
bun run android:build

# Then in Android Studio, click Run (Play button)
```

### After restarting the emulator

The port forwarding needs to be re-established:

```bash
bun run android:reverse
```

### Opening Android Studio

```bash
bun run cap:android
```

## iOS Development (macOS only)

### First-time setup

1. Install Xcode from the App Store
2. Accept the license: `sudo xcodebuild -license accept`
3. Install CocoaPods: `brew install cocoapods`
4. Install pods:
   ```bash
   cd mobile/ios/App
   pod install
   ```

### Running the app

```bash
# Build and sync
cd mobile
bun run build
bunx cap sync ios

# Open Xcode
bun run cap:ios

# In Xcode:
# 1. Select a simulator (e.g., iPhone 15)
# 2. Click Run (Play button) or Cmd+R
```

## Development Workflow

### After making code changes

```bash
# Rebuild and sync to both platforms
bun run build
bunx cap sync

# Then run from Android Studio or Xcode
```

### Running in browser (for quick testing)

```bash
bun run dev
# Opens at http://localhost:5173
```

## Scripts

| Script                    | Description                                 |
| ------------------------- | ------------------------------------------- |
| `bun run dev`             | Start dev server in browser                 |
| `bun run build`           | Build for production                        |
| `bun run android:build`   | Build + sync + port forward for Android     |
| `bun run android:reverse` | Set up port forwarding for Android emulator |
| `bun run cap:android`     | Open Android Studio                         |
| `bun run cap:ios`         | Open Xcode                                  |
| `bun run cap:sync`        | Sync web assets to native projects          |

## Project Structure

```
mobile/
├── src/
│   ├── actors/              # XState machines
│   ├── composables/         # Vue composables
│   ├── router/              # Vue Router config
│   ├── services/            # HTTP and storage services
│   ├── views/               # Page components
│   ├── App.vue              # Root component
│   └── main.ts              # Entry point
├── android/                 # Android native project
├── ios/                     # iOS native project
├── capacitor.config.ts      # Capacitor configuration
└── vite.config.ts           # Vite configuration
```

## Troubleshooting

### Android: "Transport error" when signing in

Make sure the API is running and port forwarding is set up:

```bash
# Start the API (in another terminal)
cd .. && bun run dev:api

# Set up port forwarding
bun run android:reverse
```

### iOS: CocoaPods errors

```bash
cd ios/App
pod install --repo-update
```

### iOS: Deployment target errors

Make sure the iOS deployment target is set to 16.0 in both:

- `ios/App/Podfile`
- Xcode project settings (App > General > Minimum Deployments)

### Build errors after dependency changes

```bash
# Clean and rebuild
rm -rf dist
bun run build
bunx cap sync
```
