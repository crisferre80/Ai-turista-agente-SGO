---
description: How to sync and build the mobile application with Capacitor
---
1. Make your changes in the `src` directory.
2. Build the web project to generate the static files:
   ```powershell
   npm run build
   ```
3. Sync the build with the native platforms:
   ```powershell
   npx cap sync
   ```
4. Open the project in the native IDE:
   - For Android (requires Android Studio):
     ```powershell
     npx cap open android
     ```
   - For iOS (requires macOS and Xcode):
     ```powershell
     npx cap open ios
     ```
5. Run the app from the native IDE.
