# Stremio Watch Together

An improved fork of the original Stremio Watch Together userscripts for synchronized watching on Stremio Web Player.

This fork keeps the original host/guest watch-party idea and adds a maintainable build workflow, clearer controls, manual-first sync behavior, and better diagnostics for checking whether guests are actually in sync.

## Original Project Credit

This project is based on the original **Stremio Watch Together** userscripts by **Sagar Chaulagain**.

- Original tutorial: [https://youtu.be/6wSY6W3euu8](https://youtu.be/6wSY6W3euu8)
- Original script update source: [sagarchaulagai/stremio-watch-together](https://github.com/sagarchaulagai/stremio-watch-together)

## Development

Edit the scripts in `src/`, then run:

```bash
pnpm run check
```

That lints the source and rebuilds the installable Tampermonkey files:

- `dist/host.user.js`
- `dist/guest.user.js`

Firebase defaults are injected at build time from `.env`. Copy `.env.example` to `.env` and fill in your Firebase values. If `.env` is missing or empty, the generated scripts will not connect until rebuilt with Firebase defaults.

The `dist/` folder is git-ignored because generated userscripts can contain Firebase values from `.env`.

Use `pnpm` for project commands.

## 📺 YouTube Tutorial

**Watch the complete setup guide:** [https://youtu.be/6wSY6W3euu8](https://youtu.be/6wSY6W3euu8)

## 🚀 Features

- **Manual-first synchronization** - Participants exchange playback status continuously, but time correction happens through explicit Force Sync.
- **Host/Guest system** - One person controls playback, others follow play/pause state.
- **Firebase integration** - Reliable real-time communication
- **Drift diagnostics** - The host control panel shows guest timestamps, drift, buffering, and stale/offline status.
- **Build-time configuration** - Firebase defaults are injected from `.env` into ignored `dist/` userscripts.
- **Cross-platform** - Works on any device with Tampermonkey

## 📋 Prerequisites

- **Tampermonkey browser extension** (Chrome, Firefox, Edge, Safari)
- **Firebase project** (for real-time communication)
- **Stremio Web Player** access

## 🛠️ Installation & Setup

### Step 1: Install Tampermonkey

1. **For Chrome/Edge:**
    - Go to [Chrome Web Store](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
    - Click "Add to Chrome"
    - Confirm installation

2. **For Firefox:**
    - Go to [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
    - Click "Add to Firefox"
    - Confirm installation

3. **For Safari:**
    - Go to [App Store](https://apps.apple.com/us/app/tampermonkey/id1482490089)
    - Install the app

### Step 2: Set up Firebase Project

1. **Go to Firebase Console:**
    - Visit [https://console.firebase.google.com/](https://console.firebase.google.com/)
    - Sign in with your Google account

2. **Create a New Project:**
    - Click "Create a project"
    - Enter project name: `stremio-watch-together`
    - Enable Google Analytics (optional)
    - Click "Create project"

3. **Add Web App:**
    - Click the web icon (`</>`) to add a web app
    - Register app name: `stremio-watch-together-web`
    - Check "Also set up Firebase Hosting" (optional)
    - Click "Register app"

4. **Get Firebase Configuration:**
    - Copy the Firebase configuration object
    - It should look like this:

    ```javascript
    const firebaseConfig = {
        apiKey: "your-api-key",
        authDomain: "your-project.firebaseapp.com",
        projectId: "your-project-id",
        storageBucket: "your-project.appspot.com",
        messagingSenderId: "123456789",
        appId: "your-app-id",
        measurementId: "your-measurement-id",
    };
    ```

5. **Enable Realtime Database:**
    - In Firebase Console, go to "Realtime Database"
    - Click "Create Database"
    - Choose "Start in test mode" (for development)
    - Select a location close to you
    - Click "Done"
    - Get your realtime database url,

    ```
    databaseURL: "https://your-project-default-rtdb.firebaseio.com/"
    ```

6. **Update Database Rules (Optional but Recommended):**
    - Go to "Realtime Database" → "Rules"
    - Replace the rules with:
    ```json
    {
        "rules": {
            ".read": true,
            ".write": true
        }
    }
    ```

### Step 3: Install the Userscripts

#### For Host (Person who controls playback):

1. **Open Tampermonkey Dashboard:**
    - Click Tampermonkey icon in browser
    - Select "Dashboard"

2. **Create New Script:**
    - Click "Create a new script"
    - Delete all existing content

3. **Add Host Script:**
   - Copy the entire content from `dist/host.user.js`
    - Paste it into the editor

4. **Update Firebase Configuration:**
   - Recommended: copy `.env.example` to `.env`, fill in your Firebase values, then run `pnpm run build`.
   - The generated script in `dist/` includes those defaults and should not be committed.

5. **Save the Script:**
    - Press `Ctrl+S` (or `Cmd+S` on Mac)
    - Close the editor

6. **Open Stremio:**
    - Start a video on Stremio Web Player.
    - Use the settings button only for Room ID and display name changes.

#### For Guests (People who join the session):

1. **Open Tampermonkey Dashboard:**
    - Click Tampermonkey icon in browser
    - Select "Dashboard"

2. **Create New Script:**
    - Click "Create a new script"
    - Delete all existing content

3. **Add Guest Script:**
   - Copy the entire content from `dist/guest.user.js`
    - Paste it into the editor

4. **Update Firebase Configuration:**
   - Use the same generated `.env` defaults as the host.

5. **Update Room ID (Important!):**
    - Use the settings button in Stremio to enter the same Room ID as the host.
    - You can also change the default in `src/guest.user.js` before building.

6. **Save the Script:**
    - Press `Ctrl+S` (or `Cmd+S` on Mac)
    - Close the editor

7. **Open Stremio:**
    - Start the same video as the host.
    - Click the sync button to follow host playback.

### Step 4: Using the Script

1. **Host Instructions:**
    - Go to [Stremio Web Player](https://web.stremio.com/)
    - Start playing any movie/show
    - The script will show Watch Together controls in the player bar
    - Click the sync button to begin broadcasting play/pause status
    - Open the control panel to view guest drift and use Force Sync when needed
    - Share the room ID with your friends manually

2. **Guest Instructions:**
    - Go to [Stremio Web Player](https://web.stremio.com/)
    - Make sure your room ID matches the host's room ID
    - Click the sync button to follow the host
    - Your play/pause state follows the current controller, but time drift is corrected only when the host uses Force Sync

## ⚙️ Configuration

### Changing Room ID

- Use the settings button in the Stremio player controls to update Room ID and display name.
- Hosts and guests must use the same Room ID.
- You can also change the default `ROOM_ID` in `src/host.user.js` or `src/guest.user.js` before building.

### Advanced Settings

Both scripts include settings panels accessible via the UI:

- **Room ID management**
- **Display name management**

Firebase is configured at build time through `.env`, not through the in-player settings panel.

## 🔧 Troubleshooting

### Common Issues:

1. **Script not loading:**
    - Make sure Tampermonkey is enabled
    - Check that the script is active in Tampermonkey dashboard
    - Refresh the Stremio page

2. **Connection issues:**
    - Verify Firebase configuration is correct
    - Check that room IDs match between host and guests
    - Ensure Realtime Database is enabled in Firebase

3. **Sync problems:**
    - Check internet connection
    - Check guest drift in the host control panel
    - Use Force Sync if guests are behind or ahead
    - Try refreshing the page if a guest appears stale/offline

### Debug Mode:

- Open browser console (F12)
- Look for messages starting with "👑 HOST:" or "👤 GUEST:"
- Check for any error messages

## 📝 Notes

- **Room ID must be identical** between host and all guests
- **Firebase configuration must be built into both generated scripts from the same `.env`**
- **Script only works on Stremio Web Player** (not desktop app)
- **All participants must be on the same video** for sync to work
- **Normal drift does not auto-seek**; use Force Sync for manual correction

## Improvements in This Fork

- **Force Sync button** - The host control panel can now send an immediate sync event to guests.
- **Force Sync emphasis** - The button becomes more prominent when reliable guest drift exceeds the warning threshold.
- **Guest drift visibility** - The host can see each guest's timestamp compared with the host timestamp.
- **Manual drift correction** - Normal updates show drift without auto-seeking; use Force Sync when you want everyone snapped back together.
- **Better guest status reporting** - Guests report current time, play state, buffering state, duration, and last-seen time.
- **Stale guest styling** - Guests fade and show as offline after missed heartbeats.
- **Safer drift readings** - Temporary guest video-state misses no longer appear as real `0:00` drift.
- **Non-destructive heartbeat updates** - Guest heartbeats update connection fields without wiping timestamp data.
- **More reliable video state detection** - Sync logic now prefers the browser's actual `<video>` element over fragile Stremio UI labels.
- **Clearer controls** - Sync, settings, control panel, and request-control buttons use Lucide icons instead of confusing chat-style icons.
- **Cleaner in-player settings** - Firebase editing and invite-link UI were removed; settings now focus on room ID and display name.
- **Build-time Firebase defaults** - Firebase defaults can be injected from `.env` instead of hardcoding a project in source.
- **Ignored generated output** - Built userscripts go to `dist/`, which is git-ignored so injected Firebase values are not committed.
- **Maintainable source layout** - The revived scripts live in `src/`, while generated Tampermonkey install files are written to ignored `dist/`.

Planned future improvement: add a same-video identity check so host and guests can detect when they are not watching the same Stremio item or stream.

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📄 License

This fork preserves the original MIT license. See [LICENSE](LICENSE) for details.

## 👨‍💻 Credits

Original author: **Sagar Chaulagain**

Fork improvements: maintained in this repository.

---

**Need help with the original setup flow?** Check out the [YouTube tutorial](https://youtu.be/6wSY6W3euu8).
