(function () {
    "use strict";

    // Check if we're on the player page - Logic moved to URL monitoring loop
    // if (!window.location.hash.includes('#/player/')) {
    //    console.log('HOST: Not on player page, skipping script');
    //    return;
    // }

    console.log("HOST: Watch Together Script Loading...");

    // Set flag to indicate userscript is loaded
    window.stremioWatchTogetherLoaded = true;

    // Firebase Configuration (moved to DEFAULT_FIREBASE_CONFIG below)

    // Configuration - CHANGE THIS
    let ROOM_ID = "room123"; // Default room ID - can be changed via settings
    const USER_ID = "host_" + Math.random().toString(36).substr(2, 6);
    let DISPLAY_NAME = "";

    // Default Firebase Configuration
    const DEFAULT_FIREBASE_CONFIG = __DEFAULT_FIREBASE_CONFIG__;

    let firebaseConfig = { ...DEFAULT_FIREBASE_CONFIG };
    const LUCIDE_ICONS = __LUCIDE_ICONS__;

    function lucideIcon(iconName, size = 24) {
        const icon = LUCIDE_ICONS[iconName] || LUCIDE_ICONS["circle-question-mark"] || "";
        return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icon}</svg>`;
    }

    // Escape untrusted text (e.g. guest-supplied display names) before
    // interpolating it into innerHTML to prevent markup/script injection.
    function escapeHtml(value) {
        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // True when a guest hasn't sent a heartbeat in over 20 seconds.
    function isGuestStale(guest) {
        const lastSeen = guest?.lastSeen || guest?.lastUpdated || 0;
        if (!lastSeen) return false;
        return (Date.now() - lastSeen) / 1000 > 20;
    }

    // Inject shared styles for the panel/modal once (hover feedback, animations,
    // backdrop, text truncation). Targets elements by container class so existing
    // inline styles don't need to change.
    function injectPanelStyles() {
        if (document.getElementById("watch-together-styles")) return;
        const style = document.createElement("style");
        style.id = "watch-together-styles";
        style.textContent = `
            .host-control-panel button,
            .watch-together-settings-popup button {
                transition: filter 0.15s ease, transform 0.1s ease, box-shadow 0.15s ease;
            }
            .host-control-panel button:hover,
            .watch-together-settings-popup button:hover {
                filter: brightness(1.14);
            }
            .host-control-panel button:active,
            .watch-together-settings-popup button:active {
                transform: scale(0.97);
            }
            .watch-together-settings-popup input:focus {
                outline: none;
                border-color: #FF6B35 !important;
                box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.22);
            }
            .watch-together-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0, 0, 0, 0.55);
                backdrop-filter: blur(3px);
                z-index: 9999;
                animation: wt-fade-in 0.16s ease;
            }
            .host-control-panel { animation: wt-fade-in 0.18s ease; }
            .watch-together-settings-popup { animation: wt-pop-in 0.18s ease; }
            .wt-scrollbar::-webkit-scrollbar { width: 8px; }
            .wt-scrollbar::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.18);
                border-radius: 4px;
            }
            .wt-scrollbar::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            .wt-ellipsis {
                display: block;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                max-width: 100%;
            }
            @keyframes wt-fade-in { from { opacity: 0; } to { opacity: 1; } }
            @keyframes wt-pop-in {
                from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
                to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
        `;
        document.head.appendChild(style);
    }

    // Configuration Management
    const CONFIG_STORAGE_KEY = "stremio_watch_together_config";

    // Load configuration from localStorage
    function loadConfig() {
        try {
            const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                if (config.roomId) ROOM_ID = config.roomId;
                if (config.firebaseConfig)
                    firebaseConfig = {
                        ...DEFAULT_FIREBASE_CONFIG,
                        ...config.firebaseConfig,
                    };
                if (config.displayName) DISPLAY_NAME = config.displayName;
                console.log("HOST: Configuration loaded from localStorage");
            }
        } catch (error) {
            console.error("HOST ERROR: Failed to load configuration:", error);
        }
    }

    // Save configuration to localStorage
    function saveConfig() {
        try {
            const config = {
                roomId: ROOM_ID,
                firebaseConfig: firebaseConfig,
                displayName: DISPLAY_NAME,
                lastUpdated: Date.now(),
            };
            localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
            console.log("HOST: Configuration saved to localStorage");
        } catch (error) {
            console.error("HOST ERROR: Failed to save configuration:", error);
        }
    }

    // Clear configuration
    function clearConfig() {
        try {
            localStorage.removeItem(CONFIG_STORAGE_KEY);
            ROOM_ID = "room123";
            firebaseConfig = { ...DEFAULT_FIREBASE_CONFIG };
            DISPLAY_NAME = "";
            console.log("HOST: Configuration cleared");
        } catch (error) {
            console.error("HOST ERROR: Failed to clear configuration:", error);
        }
    }

    // Generate and save persistent display name
    function initializeDisplayName() {
        try {
            const savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                if (config.displayName && config.displayName.trim() !== "") {
                    DISPLAY_NAME = config.displayName;
                    console.log("HOST: Loaded display name:", DISPLAY_NAME);
                    return;
                }
            }

            // Generate new username only if none exists
            if (!DISPLAY_NAME || DISPLAY_NAME.trim() === "") {
                DISPLAY_NAME = generateCoolUsername("host_");
                saveConfig();
                console.log("HOST: Generated new display name:", DISPLAY_NAME);
            }
        } catch (error) {
            console.error(
                "HOST ERROR: Failed to initialize display name:",
                error,
            );
            DISPLAY_NAME = generateCoolUsername("host_");
        }
    }

    // Generate a cool username
    function generateCoolUsername(baseName = "user") {
        const adjectives = [
            "Crimson",
            "Shadow",
            "Mystic",
            "Blaze",
            "Iron",
            "Quantum",
            "Solar",
            "Lunar",
            "Silent",
            "Frozen",
            "Wild",
            "Fierce",
            "Electric",
            "Golden",
            "Nebula",
            "Eternal",
            "Cobalt",
            "Obsidian",
            "Scarlet",
            "Rapid",
            "Stealthy",
            "Stormy",
            "Glacial",
            "Savage",
            "Vivid",
            "Radiant",
            "Grim",
            "Vengeful",
            "Cyber",
            "Infernal",
            "Royal",
            "Azure",
            "Burning",
            "Silent",
            "Venomous",
            "Titanic",
            "Crystalline",
            "Phantom",
            "Nocturnal",
            "Heroic",
            "Galactic",
            "Omega",
            "Prime",
            "Alpha",
            "Enchanted",
            "Magnetic",
            "Vast",
            "Twilight",
            "Echoing",
            "Wicked",
            "Stellar",
        ];

        const nouns = [
            "Phoenix",
            "Dragon",
            "Hunter",
            "Warrior",
            "Spirit",
            "Vortex",
            "Titan",
            "Specter",
            "Wolf",
            "Falcon",
            "Reaper",
            "Samurai",
            "Knight",
            "Golem",
            "Sniper",
            "Rogue",
            "Ninja",
            "Wizard",
            "Beast",
            "Ghost",
            "Lion",
            "Viper",
            "Assassin",
            "Juggernaut",
            "Guardian",
            "Sentinel",
            "Panther",
            "Serpent",
            "Rider",
            "Crusader",
            "Predator",
            "Gladiator",
            "Shadow",
            "Thunder",
            "Storm",
            "Warden",
            "Enigma",
            "Cyclone",
            "Tempest",
            "Marauder",
            "Saber",
            "Paladin",
            "Specter",
            "Hunter",
            "Nomad",
            "Titan",
            "Comet",
            "Raven",
            "Griffin",
            "Blizzard",
        ];

        const randomAdjective =
            adjectives[Math.floor(Math.random() * adjectives.length)];
        const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
        const randomNumber = Math.floor(Math.random() * 1000);

        let username = `${randomAdjective}${randomNoun}${randomNumber}`;

        if (baseName !== "user") {
            username = `${baseName}${username}`;
        }

        return username.toLowerCase();
    }

    // Check if Firebase config is properly configured
    function isFirebaseConfigValid() {
        const requiredFields = [
            "apiKey",
            "authDomain",
            "projectId",
            "databaseURL",
        ];
        for (const field of requiredFields) {
            if (
                !firebaseConfig[field] ||
                firebaseConfig[field] === field ||
                firebaseConfig[field].includes("YOUR") ||
                firebaseConfig[field].includes("placeholder")
            ) {
                return false;
            }
        }
        return true;
    }

    // Show Firebase configuration required message
    function showFirebaseConfigRequired() {
        // Create a prominent message overlay
        const overlay = document.createElement("div");
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            color: white;
            font-family: Arial, sans-serif;
        `;

        overlay.innerHTML = `
            <div style="text-align: center; max-width: 500px; padding: 40px; background: rgba(255, 107, 53, 0.1); border: 2px solid #FF6B35; border-radius: 10px;">
                <h2 style="color: #FF6B35; margin: 0 0 20px 0;">Firebase Configuration Required</h2>
                <p style="font-size: 1.1em; margin: 0 0 20px 0; line-height: 1.5;">
                    This generated userscript does not include Firebase defaults yet.
                </p>
                <p style="margin: 0 0 30px 0; opacity: 0.9;">
                    Add your Firebase values to .env, run pnpm run build, then reinstall the generated host script.
                </p>
                <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                    <button id="openSettings" style="
                        background: #FF6B35;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 1em;
                        font-weight: bold;
                    ">Room Settings</button>
                    <button id="closeMessage" style="
                        background: #666;
                        color: white;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 5px;
                        cursor: pointer;
                        font-size: 1em;
                    ">Close</button>
                </div>
                <div style="margin-top: 20px; font-size: 0.9em; opacity: 0.8;">
                    <p>Room settings are still available, but Firebase is configured at build time.</p>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Add event listeners
        document
            .getElementById("openSettings")
            .addEventListener("click", () => {
                overlay.remove();
                showSettingsPopup();
            });

        document
            .getElementById("closeMessage")
            .addEventListener("click", () => {
                overlay.remove();
            });

        console.log(
            "HOST WARNING: Firebase configuration required message displayed",
        );
    }

    // Global variables
    let app, database, roomRef;
    let watchTogetherEnabled = false;
    let isBuffering = false;
    let videoElement = null;
    let playPauseButton = null;
    let controlBar = null;
    let watchTogetherButton = null;
    let settingsButton = null;
    let settingsPopup = null;
    let settingsBackdrop = null;
    let settingsEscHandler = null;
    let bufferingObserver = null;
    let playPauseObserver = null;
    let syncInterval = null;
    let videoStateListeners = [];
    let lastSentTime = 0;
    let guestStates = {};
    let guestDriftSnapshots = {};
    let isAnyGuestBuffering = false;
    let currentControllerId = null;
    let controlRequests = {};
    let controlPanel = null;
    let isScriptActive = false;
    let isInitializationRunning = false;
    let lastForceSyncId = null;
    let seekSyncTimer = null;
    let controlPanelDirty = false;

    // Initialize Firebase
    async function initializeFirebase() {
        // Check if Firebase config is valid
        if (!isFirebaseConfigValid()) {
            console.log(
                "HOST WARNING: Firebase not configured. Please configure Firebase settings first.",
            );
            showFirebaseConfigRequired();
            return false;
        }

        try {
            const { initializeApp } =
                await import("https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js");
            const { getDatabase, ref, set, onValue } =
                await import("https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js");

            // Disconnect existing app if it exists
            if (app) {
                try {
                    await app.delete();
                } catch (e) {
                    // Ignore errors when deleting app
                }
            }

            app = initializeApp(firebaseConfig);
            database = getDatabase(app);
            roomRef = ref(database, "rooms/" + ROOM_ID);

            console.log("HOST: Firebase initialized for room:", ROOM_ID);

            // Get current video URL
            const videoURL = getCurrentVideoURL();

            // Initialize room data
            await set(roomRef, {
                roomId: ROOM_ID,
                videoURL: videoURL,
                host: {
                    userId: USER_ID,
                    displayName: DISPLAY_NAME,
                    currentTime: 0,
                    isPlaying: false,
                    isBuffering: false,
                    lastUpdated: Date.now(),
                },
                guests: {},
                permissions: {
                    controllerId: USER_ID, // Host starts with control
                },
                status: "waiting_for_guests",
            });

            // Initialize current controller
            currentControllerId = USER_ID;

            console.log("HOST: Room initialized");
            return true;
        } catch (error) {
            console.error("HOST ERROR: Firebase initialization failed:", error);
            return false;
        }
    }

    // Find DOM elements with multiple selectors
    function findDOMElements() {
        console.log("🔍 HOST: Searching for DOM elements...");

        // Try multiple selectors for video element
        videoElement =
            document.querySelector("video") ||
            document.querySelector('video[class*="video"]') ||
            document.querySelector('video[class*="player"]');

        // Try multiple selectors for control bar
        controlBar =
            document.querySelector(".control-bar-buttons-container-SWhkU") ||
            document.querySelector('[class*="control-bar-buttons"]') ||
            document.querySelector('[class*="control-bar"]') ||
            document.querySelector(".control-bar");

        // Try multiple selectors for play/pause button
        playPauseButton =
            document.querySelector('div[title="Play"], div[title="Pause"]') ||
            document.querySelector('[title="Play"], [title="Pause"]') ||
            document.querySelector(
                'button[title="Play"], button[title="Pause"]',
            );

        console.log("🔍 HOST: Found elements:", {
            video: !!videoElement,
            controlBar: !!controlBar,
            playPauseButton: !!playPauseButton,
        });

        if (videoElement && controlBar && playPauseButton) {
            console.log("HOST: All DOM elements found");
            return true;
        }

        console.log("HOST ERROR: Missing elements:", {
            video: !videoElement,
            controlBar: !controlBar,
            playPauseButton: !playPauseButton,
        });

        return false;
    }

    // Create Watch Together button
    function createWatchTogetherButton() {
        if (watchTogetherButton) {
            watchTogetherButton.remove();
        }

        watchTogetherButton = document.createElement("div");
        watchTogetherButton.className =
            "control-bar-button-FQUsj button-container-zVLH6";
        watchTogetherButton.title = "Sync Off - click to broadcast";
        watchTogetherButton.style.cssText = `
            cursor: pointer;
            width: 42px;
            height: 42px;
            min-width: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.22);
            border-radius: 6px;
            background: rgba(10, 12, 16, 0.56);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(8px);
        `;

        watchTogetherButton.innerHTML = lucideIcon("wifi-sync", 22);

        controlBar.appendChild(watchTogetherButton);
        watchTogetherButton.addEventListener("click", toggleWatchTogether);
        updateSyncButtonState();

        console.log("HOST: Watch Together button created");
    }

    // Create Control Panel toggle button
    function createControlPanelButton() {
        const existingButton = document.querySelector(
            ".control-panel-toggle-button",
        );
        if (existingButton) {
            existingButton.remove();
        }

        const panelButton = document.createElement("div");
        panelButton.className =
            "control-bar-button-FQUsj button-container-zVLH6 control-panel-toggle-button";
        panelButton.title = "Watch Together Control Panel";
        panelButton.style.cssText = `
            cursor: pointer;
            width: 42px;
            height: 42px;
            min-width: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.22);
            border-radius: 6px;
            background: rgba(10, 12, 16, 0.56);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(8px);
            margin-left: 4px;
        `;

        panelButton.innerHTML = lucideIcon("sliders-horizontal", 22);

        controlBar.appendChild(panelButton);
        panelButton.addEventListener("click", toggleControlPanel);

        console.log("HOST: Control panel button created");
    }

    // Create Settings button
    function createSettingsButton() {
        if (settingsButton) {
            settingsButton.remove();
        }

        settingsButton = document.createElement("div");
        settingsButton.className =
            "control-bar-button-FQUsj button-container-zVLH6";
        settingsButton.title = "Watch Together Settings";
        settingsButton.style.cssText = `
            cursor: pointer;
            width: 42px;
            height: 42px;
            min-width: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            border: 1px solid rgba(255, 255, 255, 0.22);
            border-radius: 6px;
            background: rgba(10, 12, 16, 0.56);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
            backdrop-filter: blur(8px);
            margin-left: 4px;
        `;

        settingsButton.innerHTML = lucideIcon("settings", 22);

        controlBar.appendChild(settingsButton);
        settingsButton.addEventListener("click", toggleSettingsPopup);

        console.log("HOST: Settings button created");
    }

    function hideSettingsPopup() {
        if (settingsPopup) {
            settingsPopup.remove();
            settingsPopup = null;
        }
        if (settingsBackdrop) {
            settingsBackdrop.remove();
            settingsBackdrop = null;
        }
        if (settingsEscHandler) {
            document.removeEventListener("keydown", settingsEscHandler);
            settingsEscHandler = null;
        }
    }

    function clearAllSettings() {
        if (
            confirm(
                "Are you sure you want to clear local room and display-name settings?",
            )
        ) {
            clearConfig();
            hideSettingsPopup();
            showGuestStatus("Settings cleared - reloading...");
            setTimeout(() => {
                location.reload();
            }, 1200);
        }
    }

    function toggleSettingsPopup() {
        if (settingsPopup) {
            hideSettingsPopup();
            return;
        }

        showSettingsPopup();
    }

    async function copySettingsText(value, buttonId) {
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(value);
            } else {
                const textArea = document.createElement("textarea");
                textArea.value = value;
                textArea.style.position = "fixed";
                textArea.style.opacity = "0";
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand("copy");
                textArea.remove();
            }

            const button = document.getElementById(buttonId);
            if (button) {
                const originalText = button.textContent;
                button.textContent = "Copied";
                setTimeout(() => {
                    button.textContent = originalText;
                }, 1600);
            }
        } catch (error) {
            console.error("HOST ERROR: Failed to copy text:", error);
            alert("Failed to copy. Please copy manually.");
        }
    }

    function showSettingsPopup() {
        hideSettingsPopup();

        settingsBackdrop = document.createElement("div");
        settingsBackdrop.className = "watch-together-backdrop";
        settingsBackdrop.addEventListener("click", hideSettingsPopup);
        document.body.appendChild(settingsBackdrop);

        settingsPopup = document.createElement("div");
        settingsPopup.className = "watch-together-settings-popup";
        settingsPopup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            border: 2px solid #FF6B35;
            border-radius: 12px;
            padding: 0;
            z-index: 10000;
            width: 440px;
            max-width: 95vw;
            color: white;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
            overflow: hidden;
        `;

        settingsPopup.innerHTML = `
            <div style="background: linear-gradient(135deg, #FF6B35 0%, #ff8c42 100%); padding: 18px; display: flex; align-items: center; justify-content: space-between; gap: 12px;">
                <div>
                    <h3 style="margin: 0; font-size: 20px; font-weight: 700;">Watch Together Settings</h3>
                    <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 13px;">Room and identity settings</p>
                </div>
                <button id="closeSettings" title="Close Settings" aria-label="Close Settings" style="background: rgba(0,0,0,0.2); border: none; color: white; width: 34px; height: 34px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 20px; line-height: 1;">&times;</button>
            </div>
            <div style="padding: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #e0e0e0;">Display Name</label>
                <input type="text" id="displayNameInput" value="${DISPLAY_NAME || ""}" style="width: 100%; box-sizing: border-box; margin-bottom: 16px; padding: 12px; border: 2px solid #444; border-radius: 8px; background: #2a2a2a; color: white; font-size: 14px;">

                <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #e0e0e0;">Room ID</label>
                <div style="display: flex; gap: 8px; margin-bottom: 16px;">
                    <input type="text" id="roomIdInput" value="${ROOM_ID}" style="flex: 1; min-width: 0; padding: 12px; border: 2px solid #444; border-radius: 8px; background: #2a2a2a; color: white; font-size: 14px;">
                    <button id="copyRoomId" title="Copy Room ID" style="width: 46px; border: none; border-radius: 8px; background: #444; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center;">${lucideIcon("clipboard-copy", 20)}</button>
                </div>

                <div style="padding: 12px; border-left: 4px solid #FF6B35; background: rgba(255, 107, 53, 0.08); color: #ddd; font-size: 12px; line-height: 1.45; margin-bottom: 20px;">
                    Firebase defaults are built into the userscript from .env. This panel only changes your room and display name.
                </div>

                <div style="display: flex; justify-content: space-between; gap: 12px;">
                    <button id="clearConfig" style="padding: 11px 14px; background: #666; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">Clear Local</button>
                    <div style="display: flex; gap: 10px;">
                        <button id="cancelSettings" style="padding: 11px 14px; background: #666; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600;">Cancel</button>
                        <button id="saveSettings" style="padding: 11px 16px; background: linear-gradient(135deg, #FF6B35 0%, #ff8c42 100%); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 700;">Save</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(settingsPopup);
        document.getElementById("closeSettings").addEventListener("click", hideSettingsPopup);
        document.getElementById("cancelSettings").addEventListener("click", hideSettingsPopup);
        document.getElementById("saveSettings").addEventListener("click", saveSettings);
        document.getElementById("clearConfig").addEventListener("click", clearAllSettings);
        document.getElementById("copyRoomId").addEventListener("click", () => copySettingsText(document.getElementById("roomIdInput").value.trim(), "copyRoomId"));
        document.getElementById("roomIdInput").addEventListener("keydown", (e) => {
            if (e.key === "Enter") saveSettings();
        });

        settingsEscHandler = (e) => {
            if (e.key === "Escape") hideSettingsPopup();
        };
        document.addEventListener("keydown", settingsEscHandler);

        document.getElementById("displayNameInput").focus();

        console.log("HOST: Settings popup shown");
    }

    async function saveSettings() {
        const newRoomId = document.getElementById("roomIdInput").value.trim();
        const newDisplayName = document.getElementById("displayNameInput").value.trim();

        if (!newRoomId) {
            alert("Room ID cannot be empty!");
            return;
        }

        const roomChanged = newRoomId !== ROOM_ID;
        const nameChanged = newDisplayName !== DISPLAY_NAME;

        if (!roomChanged && !nameChanged) {
            hideSettingsPopup();
            return;
        }

        if (watchTogetherEnabled && roomChanged) {
            stopSync();
        }

        ROOM_ID = newRoomId;
        DISPLAY_NAME = newDisplayName;
        saveConfig();

        if (roomChanged) {
            const firebaseReady = await initializeFirebase();
            if (!firebaseReady) {
                alert("Room saved, but Firebase could not reconnect. Check the built Firebase config.");
                return;
            }
        }

        hideSettingsPopup();
        showGuestStatus(`Settings updated - Room: ${ROOM_ID}`);
        setTimeout(() => {
            const existingStatus = document.querySelector(".guest-status-display");
            if (existingStatus) existingStatus.remove();
        }, 3000);
    }

    function updateSyncButtonState() {
        if (!watchTogetherButton) return;

        if (watchTogetherEnabled) {
            watchTogetherButton.title = "Sync On - broadcasting playback";
            watchTogetherButton.style.background = "rgba(255, 107, 53, 0.72)";
            watchTogetherButton.style.borderColor = "rgba(255, 185, 145, 0.95)";
            watchTogetherButton.style.boxShadow =
                "inset 0 0 0 1px rgba(255, 255, 255, 0.16)";
            watchTogetherButton.style.opacity = "1";
        } else {
            watchTogetherButton.title = "Sync Off - click to broadcast";
            watchTogetherButton.style.background = "rgba(10, 12, 16, 0.56)";
            watchTogetherButton.style.borderColor = "rgba(255, 255, 255, 0.22)";
            watchTogetherButton.style.boxShadow =
                "inset 0 -2px 0 rgba(255, 107, 53, 0.72)";
            watchTogetherButton.style.opacity = "0.92";
        }
    }

    // Toggle Watch Together functionality
    function toggleWatchTogether() {
        // Check if Firebase is configured
        if (!isFirebaseConfigValid()) {
            showFirebaseConfigRequired();
            return;
        }

        watchTogetherEnabled = !watchTogetherEnabled;

        if (watchTogetherEnabled) {
            updateSyncButtonState();
            console.log(
                "HOST: Watch Together ENABLED - You are controlling playback",
            );
            startSync();
        } else {
            updateSyncButtonState();
            console.log("HOST: Watch Together DISABLED");
            stopSync();
        }
    }

    // Get current time from timer
    function getCurrentTime() {
        if (videoElement && Number.isFinite(videoElement.currentTime)) {
            return videoElement.currentTime;
        }

        const timerElement = document.querySelector(".label-QFbsS");
        if (!timerElement) return 0;

        const timeStr = timerElement.textContent;
        const parts = timeStr.split(":").map(Number);
        if (parts.some((part) => Number.isNaN(part))) return 0;
        if (parts.length === 2) return parts[0] * 60 + parts[1];
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }

    // Get play/pause state
    function getPlayState() {
        if (videoElement) {
            return !videoElement.paused;
        }

        if (!playPauseButton) return false;
        return playPauseButton.getAttribute("title") === "Pause";
    }

    function setPlayState(shouldPlay) {
        if (videoElement) {
            if (shouldPlay) {
                const playPromise = videoElement.play();
                if (playPromise && typeof playPromise.catch === "function") {
                    playPromise.catch(() => {
                        if (playPauseButton) playPauseButton.click();
                    });
                }
            } else {
                videoElement.pause();
            }
            return;
        }

        if (playPauseButton) {
            playPauseButton.click();
        }
    }

    // Check if video is buffering
    function isVideoBuffering() {
        if (videoElement) {
            return (
                videoElement.readyState < HTMLMediaElement.HAVE_FUTURE_DATA ||
                videoElement.networkState === HTMLMediaElement.NETWORK_LOADING
            );
        }

        const bufferingLayer = document.querySelector(".buffering-layer-ZZCYp");
        return (
            bufferingLayer &&
            bufferingLayer.style.display !== "none" &&
            bufferingLayer.offsetParent !== null
        );
    }

    function getVideoDuration() {
        return videoElement && Number.isFinite(videoElement.duration)
            ? videoElement.duration
            : 0;
    }

    function formatTimestamp(seconds) {
        const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
        const hours = Math.floor(safeSeconds / 3600);
        const minutes = Math.floor((safeSeconds % 3600) / 60);
        const secs = safeSeconds % 60;
        if (hours > 0) {
            return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
        }
        return `${minutes}:${String(secs).padStart(2, "0")}`;
    }

    function getDriftInfo(guestTime, hostTime = getCurrentTime()) {
        const drift = (guestTime || 0) - hostTime;
        const absoluteDrift = Math.abs(drift);
        const color =
            absoluteDrift <= 1.5
                ? "#4CAF50"
                : absoluteDrift <= 4
                  ? "#ff9800"
                  : "#f44336";
        const label =
            absoluteDrift <= 0.5
                ? "in sync"
                : `${drift > 0 ? "+" : "-"}${absoluteDrift.toFixed(1)}s`;
        return { drift, absoluteDrift, color, label };
    }

    function getGuestDriftSignature(guest) {
        return [
            Number.isFinite(guest.currentTime) ? guest.currentTime.toFixed(3) : "none",
            guest.lastUpdated || 0,
            guest.timeReliable !== false,
            !!guest.isPlaying,
            !!guest.isBuffering,
        ].join("|");
    }

    function updateGuestDriftSnapshots(guests) {
        const activeGuestIds = new Set(Object.keys(guests || {}));

        for (const guestId of Object.keys(guestDriftSnapshots)) {
            if (!activeGuestIds.has(guestId)) {
                delete guestDriftSnapshots[guestId];
            }
        }

        for (const [guestId, guest] of Object.entries(guests || {})) {
            if (!guest) continue;

            const signature = getGuestDriftSignature(guest);
            if (guestDriftSnapshots[guestId]?.signature === signature) {
                continue;
            }

            const hostTime = getCurrentTime();
            const guestTime = Number.isFinite(guest.currentTime)
                ? guest.currentTime
                : 0;
            const timeReliable = guest.timeReliable !== false;

            guestDriftSnapshots[guestId] = {
                signature,
                hostTime,
                guestTime,
                timeReliable,
                driftInfo: timeReliable ? getDriftInfo(guestTime, hostTime) : null,
                sampledAt: Date.now(),
            };
        }
    }

    // Check if movie has loaded (timer shows actual time instead of --:--:--)
    function isMovieLoaded() {
        const timerElement = document.querySelector(".label-QFbsS");
        if (!timerElement) return false;

        const timeStr = timerElement.textContent;
        // Check if timer shows actual time (not --:--:--)
        return !timeStr.includes("--");
    }

    // Get current video URL
    function getCurrentVideoURL() {
        const currentURL = window.location.href;
        console.log("HOST: Current URL:", currentURL);
        return currentURL;
    }

    // Validate if URL is a valid Stremio video URL
    function isValidStremioVideoURL(url) {
        try {
            const urlObj = new URL(url);
            return (
                urlObj.hostname.includes("stremio.com") &&
                (urlObj.pathname.includes("/player/") ||
                    urlObj.hash.includes("#/player/"))
            );
        } catch (error) {
            return false;
        }
    }

    // Get controller state from Firebase data
    function getControllerState(data) {
        if (!data || !data.permissions || !data.permissions.controllerId) {
            return null;
        }

        const controllerId = data.permissions.controllerId;

        // Check if host has control
        if (data.host && data.host.userId === controllerId) {
            return data.host;
        }

        // Check if a guest has control
        if (data.guests && data.guests[controllerId]) {
            return data.guests[controllerId];
        }

        return null;
    }

    // Apply controller state to host's video
    function applyControllerState(controllerState) {
        if (!watchTogetherEnabled || !videoElement || !controllerState) return;

        console.log("HOST: Applying controller state:", controllerState);

        const localIsPlaying = getPlayState();

        // Sync play/pause state
        if (controllerState.isPlaying !== undefined) {
            if (controllerState.isPlaying && !localIsPlaying) {
                console.log("HOST: Controller playing - resuming video");
                setPlayState(true);
            } else if (!controllerState.isPlaying && localIsPlaying) {
                console.log("HOST: Controller paused - pausing video");
                setPlayState(false);
            }
        }
    }

    // Send host state to Firebase
    async function sendHostState() {
        if (!watchTogetherEnabled || !roomRef) return;

        try {
            const { update } =
                await import("https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js");

            // Only send video control updates if we have the control token
            if (currentControllerId !== USER_ID) {
                console.log(
                    "HOST: Not sending state - control delegated to:",
                    currentControllerId,
                );
                return;
            }

            const currentTime = getCurrentTime();
            const isPlaying = getPlayState();
            const isCurrentlyBuffering = isVideoBuffering();

            const hostState = {
                userId: USER_ID,
                displayName: DISPLAY_NAME,
                currentTime: currentTime,
                isPlaying: isPlaying,
                isBuffering: isCurrentlyBuffering,
                duration: getVideoDuration(),
                lastUpdated: Date.now(),
            };

            // Get current video URL
            const videoURL = getCurrentVideoURL();

            // Update only the host data and video URL
            await update(roomRef, {
                host: hostState,
                videoURL: videoURL,
                status: "active",
            });

            lastSentTime = currentTime;
        } catch (error) {
            console.error("HOST ERROR: Failed to send state:", error);
        }
    }

    async function forceSyncGuests() {
        if (!watchTogetherEnabled || !roomRef) {
            console.log(
                "HOST WARNING: Enable Watch Together before forcing sync",
            );
            return;
        }

        try {
            const { update } =
                await import("https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js");
            const currentTime = getCurrentTime();
            const syncId = `${USER_ID}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const forceSyncState = {
                syncId,
                issuedAt: Date.now(),
                issuedBy: USER_ID,
                currentTime,
                isPlaying: getPlayState(),
                isBuffering: isVideoBuffering(),
                duration: getVideoDuration(),
            };

            await update(roomRef, {
                host: {
                    userId: USER_ID,
                    displayName: DISPLAY_NAME,
                    currentTime,
                    isPlaying: forceSyncState.isPlaying,
                    isBuffering: forceSyncState.isBuffering,
                    duration: forceSyncState.duration,
                    lastUpdated: Date.now(),
                },
                forceSync: forceSyncState,
                status: "active",
            });

            lastForceSyncId = syncId;
            updateControlPanel();
            console.log("HOST: Force sync issued:", forceSyncState);
        } catch (error) {
            console.error("HOST ERROR: Failed to force sync guests:", error);
        }
    }

    // Listen for guest status updates
    async function startGuestListener() {
        try {
            const { onValue } =
                await import("https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js");

            onValue(roomRef, (snapshot) => {
                const data = snapshot.val();

                // Handle guests
                if (data && data.guests) {
                    const guestCount = Object.keys(data.guests).length;
                    console.log(`HOST: ${guestCount} guest(s) connected`);

                    // Update guest states
                    guestStates = data.guests;
                    updateGuestDriftSnapshots(guestStates);

                    // Check for guest buffering
                    checkGuestBuffering();

                    // Show guest status in UI
                    showGuestStatus(guestCount);

                    // Update control panel
                    updateControlPanel();
                } else if (data && !data.guests) {
                    guestStates = {};
                    guestDriftSnapshots = {};
                    updateControlPanel();
                }

                // Update permissions
                if (data && data.permissions) {
                    if (data.permissions.controllerId) {
                        currentControllerId = data.permissions.controllerId;
                    }
                    if (data.permissions.controlRequests) {
                        controlRequests = data.permissions.controlRequests;
                    } else {
                        controlRequests = {};
                    }

                    // Update control panel
                    updateControlPanel();
                }

                // Apply controller state if we don't have control
                if (currentControllerId !== USER_ID) {
                    const controllerState = getControllerState(data);
                    if (controllerState) {
                        console.log(
                            "HOST: Detected controller state change, applying:",
                            controllerState,
                        );
                        applyControllerState(controllerState);
                    }
                }
            });

            console.log("HOST: Guest listener started");
        } catch (error) {
            console.error("HOST ERROR: Failed to start guest listener:", error);
        }
    }

    // Check if any guests are buffering
    function checkGuestBuffering() {
        console.log("🔍 HOST: Checking guest buffering states:", guestStates);

        // Filter out guests that are not connected or don't have buffering info
        const activeGuests = Object.values(guestStates).filter(
            (guest) => guest && guest.connected !== false,
        );

        const bufferingGuests = activeGuests.filter(
            (guest) => guest.isBuffering === true,
        );

        console.log(
            "🔍 HOST: Active guests:",
            activeGuests.length,
            "Buffering guests:",
            bufferingGuests.length,
        );

        const wasAnyBuffering = isAnyGuestBuffering;
        isAnyGuestBuffering = bufferingGuests.length > 0;

        console.log(
            "🔍 HOST: wasAnyBuffering:",
            wasAnyBuffering,
            "isAnyGuestBuffering:",
            isAnyGuestBuffering,
        );

        if (isAnyGuestBuffering && !wasAnyBuffering) {
            // At least one guest started buffering - pause host video
            console.log("HOST: Guest(s) buffering - pausing video");
            if (getPlayState() && playPauseButton) {
                playPauseButton.click();
            }
            showGuestBufferingStatus(bufferingGuests.length);
            showGuestBufferingIcon(bufferingGuests.length);
        } else if (!isAnyGuestBuffering && wasAnyBuffering) {
            // No guests are buffering anymore
            console.log("HOST: All guests finished buffering - hiding icon");
            hideGuestBufferingStatus();
            hideGuestBufferingIcon();
        } else if (!isAnyGuestBuffering && !wasAnyBuffering) {
            // Make sure icon is hidden when no guests are buffering
            hideGuestBufferingStatus();
            hideGuestBufferingIcon();
        }
    }

    // Show guest buffering status
    function showGuestBufferingStatus(bufferingCount) {
        hideGuestBufferingStatus(); // Remove existing message

        // Find control bar dynamically
        const currentControlBar = document.querySelector(
            ".control-bar-buttons-container-SWhkU",
        );
        if (!currentControlBar) return;

        const statusDiv = document.createElement("div");
        statusDiv.className = "guest-buffering-status";
        statusDiv.style.cssText = `
            position: absolute;
            top: -60px;
            right: 10px;
            background: rgba(255, 107, 53, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            z-index: 1000;
            border: 2px solid #FF6B35;
        `;
        statusDiv.textContent = `${bufferingCount} guest(s) buffering - video paused`;

        const controlBarContainer = currentControlBar.closest(".control-bar");
        if (controlBarContainer) {
            controlBarContainer.style.position = "relative";
            controlBarContainer.appendChild(statusDiv);
        }
    }

    // Show guest buffering loading icon
    function showGuestBufferingIcon(bufferingCount) {
        hideGuestBufferingIcon(); // Remove existing icon

        const loadingIcon = document.createElement("div");
        loadingIcon.className = "guest-buffering-icon";
        loadingIcon.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            width: 30px;
            height: 30px;
            z-index: 10000;
            pointer-events: none;
            background: rgba(0, 0, 0, 0.8);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        loadingIcon.innerHTML = `
            <div style="
                width: 20px;
                height: 20px;
                border: 2px solid rgba(76, 175, 80, 0.3);
                border-top: 2px solid #4CAF50;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            "></div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;

        // Add to body for better visibility
        document.body.appendChild(loadingIcon);
        console.log("HOST: Guest buffering icon displayed");
    }

    // Hide guest buffering loading icon
    function hideGuestBufferingIcon() {
        const existingIcon = document.querySelector(".guest-buffering-icon");
        if (existingIcon) {
            existingIcon.remove();
        }
    }

    // Hide guest buffering status
    function hideGuestBufferingStatus() {
        const existingMessage = document.querySelector(
            ".guest-buffering-status",
        );
        if (existingMessage) {
            existingMessage.remove();
        }
    }

    // Show notification message
    function showNotification(message, color = "#FF6B35") {
        // Remove existing notification
        const existingNotification = document.querySelector(
            ".control-notification",
        );
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement("div");
        notification.className = "control-notification";
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.95);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            z-index: 10001;
            border: 2px solid ${color};
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            animation: slideDown 0.3s ease;
        `;
        notification.innerHTML = `
            <style>
                @keyframes slideDown {
                    from {
                        transform: translateX(-50%) translateY(-20px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(-50%) translateY(0);
                        opacity: 1;
                    }
                }
            </style>
            ${message}
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 3000);
    }

    // Delegate control to a guest
    async function delegateControl(guestUserId) {
        if (!roomRef) return;

        const guestName = guestStates[guestUserId]?.displayName || guestUserId;

        try {
            const { update } =
                await import("https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js");

            await update(roomRef, {
                "permissions/controllerId": guestUserId,
            });

            currentControllerId = guestUserId;
            showNotification(`Control delegated to ${guestName}`, "#4CAF50");
            updateControlPanel();

            console.log("HOST: Control delegated to", guestUserId);
        } catch (error) {
            console.error("HOST ERROR: Failed to delegate control:", error);
            showNotification("Failed to delegate control", "#f44336");
        }
    }

    // Take back control
    async function takeBackControl() {
        if (!roomRef) return;

        try {
            const { update } =
                await import("https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js");

            await update(roomRef, {
                "permissions/controllerId": USER_ID,
                "permissions/controlRequests": null,
            });

            currentControllerId = USER_ID;
            controlRequests = {};
            showNotification("You now have control", "#FF6B35");
            updateControlPanel();

            console.log("HOST: Took back control");
        } catch (error) {
            console.error("HOST ERROR: Failed to take back control:", error);
            showNotification("Failed to take back control", "#f44336");
        }
    }

    // Approve control request from guest
    async function approveControlRequest(guestUserId) {
        if (!roomRef) return;

        const guestName =
            controlRequests[guestUserId]?.displayName ||
            guestStates[guestUserId]?.displayName ||
            guestUserId;

        try {
            const { update } =
                await import("https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js");

            await update(roomRef, {
                "permissions/controllerId": guestUserId,
                [`permissions/controlRequests/${guestUserId}`]: null,
            });

            currentControllerId = guestUserId;
            delete controlRequests[guestUserId];
            showNotification(`Control granted to ${guestName}`, "#4CAF50");
            updateControlPanel();

            console.log("HOST: Approved control request from", guestUserId);
        } catch (error) {
            console.error(
                "HOST ERROR: Failed to approve control request:",
                error,
            );
            showNotification("Failed to approve request", "#f44336");
        }
    }

    // Deny control request from guest
    async function denyControlRequest(guestUserId) {
        if (!roomRef) return;

        try {
            const { update } =
                await import("https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js");

            await update(roomRef, {
                [`permissions/controlRequests/${guestUserId}`]: null,
            });

            delete controlRequests[guestUserId];
            updateControlPanel();

            console.log("HOST: Denied control request from", guestUserId);
        } catch (error) {
            console.error("HOST ERROR: Failed to deny control request:", error);
        }
    }

    // Remove an offline guest from the database and local state
    async function removeOfflineGuest(guestUserId) {
        if (!roomRef) return;

        try {
            const { update } =
                await import("https://www.gstatic.com/firebasejs/12.4.0/firebase-database.js");

            await update(roomRef, {
                [`guests/${guestUserId}`]: null,
                [`permissions/controlRequests/${guestUserId}`]: null,
            });

            delete guestStates[guestUserId];
            delete guestDriftSnapshots[guestUserId];
            delete controlRequests[guestUserId];
            updateControlPanel();

            console.log("HOST: Removed offline guest", guestUserId);
        } catch (error) {
            console.error("HOST ERROR: Failed to remove guest:", error);
            showNotification("Failed to remove guest", "#f44336");
        }
    }

    // Create control panel UI
    function createControlPanel() {
        if (controlPanel) {
            controlPanel.remove();
        }

        controlPanel = document.createElement("div");
        controlPanel.className = "host-control-panel";
        controlPanel.style.cssText = `
            position: fixed;
            top: 150px;
            right: 20px;
            width: 320px;
            max-height: 500px;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            border: 2px solid #FF6B35;
            border-radius: 12px;
            padding: 0;
            z-index: 9999;
            color: white;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
            overflow: hidden;
            display: none;
        `;

        updateControlPanel();

        document.body.appendChild(controlPanel);
        console.log("HOST: Control panel created");
    }

    // Update control panel content
    function updateControlPanel() {
        if (!controlPanel) return;

        // Skip the (expensive) full re-render while the panel is hidden; it will
        // be rebuilt the next time it's shown. Avoids needless work every ~2s.
        if (controlPanel.style.display === "none") {
            controlPanelDirty = true;
            return;
        }

        const guestEntries = Object.entries(guestStates).filter(([, guest]) => guest);
        const guestCount = guestEntries.length;
        const onlineCount = guestEntries.filter(([, guest]) => !isGuestStale(guest)).length;
        const offlineCount = guestCount - onlineCount;
        const requestCount = Object.keys(controlRequests).length;
        const hostTime = getCurrentTime();
        const hasActionableDrift = guestEntries.some(([guestId, guest]) => {
            if (guest.timeReliable === false || isGuestStale(guest)) return false;
            return (guestDriftSnapshots[guestId]?.driftInfo?.absoluteDrift || 0) > 4;
        });
        const forceSyncButtonLabel = hasActionableDrift
            ? "Force Sync Guests - Drift Detected"
            : "Force Sync Guests";
        const forceSyncButtonStyle = hasActionableDrift
            ? "width: 100%; padding: 10px; background: #f44336; color: white; border: 1px solid rgba(255,255,255,0.35); border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 13px; margin-bottom: 8px; box-shadow: 0 0 0 3px rgba(244,67,54,0.18);"
            : "width: 100%; padding: 10px; background: #2196F3; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; margin-bottom: 8px;";
        const lastSyncLabel = lastForceSyncId
            ? `Last force sync: ${formatTimestamp(hostTime)}`
            : "No force sync sent yet";

        let controllerName = "You";
        if (currentControllerId !== USER_ID) {
            const controller = guestStates[currentControllerId];
            controllerName = controller ? controller.displayName : "Unknown";
        }

        let guestHTML = "";
        for (const [guestId, guest] of guestEntries) {
            const isController = currentControllerId === guestId;
            const hasRequest = controlRequests[guestId];
            const driftSnapshot = guestDriftSnapshots[guestId];
            const guestTime = driftSnapshot
                ? driftSnapshot.guestTime
                : Number.isFinite(guest.currentTime)
                  ? guest.currentTime
                  : 0;
            const sampledHostTime = driftSnapshot
                ? driftSnapshot.hostTime
                : hostTime;
            const timeReliable = driftSnapshot
                ? driftSnapshot.timeReliable
                : guest.timeReliable !== false;
            const driftInfo = driftSnapshot?.driftInfo || null;
            const lastSeen = guest.lastSeen || guest.lastUpdated || 0;
            const secondsSinceSeen = lastSeen
                ? Math.max(0, Math.round((Date.now() - lastSeen) / 1000))
                : null;
            const isStale = isGuestStale(guest);
            const statusLabel = guest.isBuffering
                ? "buffering"
                : guest.isPlaying
                  ? "playing"
                  : "paused";
            const guestRowBackground = isStale
                ? "rgba(244, 67, 54, 0.08)"
                : "transparent";
            const guestRowOpacity = isStale ? "0.62" : "1";

            guestHTML += `
                <div style="padding: 12px; border-bottom: 1px solid #333; display: flex; align-items: center; justify-content: space-between; background: ${guestRowBackground}; opacity: ${guestRowOpacity};">
                    <div style="flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0;">
                        ${isController ? '<span style="font-size: 16px;">👑</span>' : ""}
                        <span class="wt-ellipsis" style="font-weight: ${isController ? "600" : "400"}; color: ${isController ? "#4CAF50" : "#e0e0e0"};">
                            ${escapeHtml(guest.displayName || guestId)}
                        </span>
                        <span style="font-size: 11px; color: ${timeReliable && driftInfo ? driftInfo.color : "#aaa"}; font-weight: 700;">
                            ${isStale ? "offline" : timeReliable && driftInfo ? `Guest ${driftInfo.label}` : "checking time..."}
                        </span>
                        <span style="font-size: 11px; color: #aaa;">
                            ${timeReliable ? `Host ${formatTimestamp(sampledHostTime)} vs Guest ${formatTimestamp(guestTime)}` : `Last host ${formatTimestamp(sampledHostTime)} vs guest ${formatTimestamp(guestTime)}`} - ${statusLabel}${secondsSinceSeen === null ? "" : `, ${secondsSinceSeen}s ago`}
                        </span>
                    </div>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        ${
                            isStale
                                ? `
                            <button onclick="window.removeOfflineGuestHandler('${guestId}')"
                                    style="padding: 6px 10px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">
                                Remove
                            </button>
                        `
                                : ""
                        }
                        ${
                            !isStale && !isController && !hasRequest
                                ? `
                            <button onclick="window.delegateControlToGuest('${guestId}')"
                                    style="padding: 6px 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600;">
                                Give Control
                            </button>
                        `
                                : ""
                        }
                        ${
                            !isStale && isController && currentControllerId !== USER_ID
                                ? `
                            <span style="color: #4CAF50; font-size: 11px; font-weight: 600;">CONTROLLING</span>
                        `
                                : ""
                        }
                    </div>
                </div>
            `;
        }

        let requestsHTML = "";
        for (const [requesterId, request] of Object.entries(controlRequests)) {
            if (!request) continue;

            requestsHTML += `
                <div style="padding: 12px; border-bottom: 1px solid #333; display: flex; align-items: center; justify-content: space-between; background: rgba(255, 152, 0, 0.1);">
                    <div style="flex: 1; min-width: 0;">
                        <div class="wt-ellipsis" style="font-weight: 600; color: #ff9800; font-size: 13px;">${escapeHtml(request.displayName || requesterId)}</div>
                        <div style="font-size: 11px; color: #aaa;">Requesting control</div>
                    </div>
                    <div style="display: flex; gap: 6px;">
                        <button onclick="window.approveControlRequestHandler('${requesterId}')" title="Approve control" aria-label="Approve control"
                                style="padding: 6px 12px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">
                            ✓
                        </button>
                        <button onclick="window.denyControlRequestHandler('${requesterId}')" title="Deny control" aria-label="Deny control"
                                style="padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600;">
                            ✗
                        </button>
                    </div>
                </div>
            `;
        }

        // Preserve the guest list's scroll position across the full re-render.
        const prevScroll = controlPanel.querySelector(".wt-guest-list")?.scrollTop || 0;

        controlPanel.innerHTML = `
            <div style="background: linear-gradient(135deg, #FF6B35 0%, #ff8c42 100%); padding: 15px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="font-weight: 600; font-size: 16px;">Control Panel</div>
                    <div style="font-size: 12px; opacity: 0.9;">${onlineCount} online${offlineCount > 0 ? ` &middot; ${offlineCount} offline` : ""}</div>
                </div>
                <button onclick="window.toggleControlPanel()" style="background: transparent; border: none; color: white; font-size: 20px; cursor: pointer; padding: 0; width: 24px; height: 24px;">×</button>
            </div>

            <div style="padding: 15px; border-bottom: 2px solid #333;">
                <div style="font-size: 13px; color: #aaa; margin-bottom: 8px;">Current Controller:</div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                    <span style="font-size: 20px;">👑</span>
                    <span style="font-weight: 600; font-size: 15px; color: #4CAF50;">${escapeHtml(controllerName)}</span>
                </div>
                <div style="font-size: 12px; color: #ccc; margin-bottom: 10px;">
                    <div>Host time: ${formatTimestamp(hostTime)}</div>
                    <div>${lastSyncLabel}</div>
                </div>
                <button onclick="window.forceSyncGuestsHandler()" style="${forceSyncButtonStyle}">
                    ${forceSyncButtonLabel}
                </button>
                ${
                    currentControllerId !== USER_ID
                        ? `
                    <button onclick="window.takeBackControlHandler()" style="width: 100%; padding: 10px; background: #FF6B35; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px;">
                        Take Back Control
                    </button>
                `
                        : ""
                }
            </div>

            ${
                requestCount > 0
                    ? `
                <div style="background: rgba(255, 152, 0, 0.05);">
                    <div style="padding: 12px 15px; font-weight: 600; font-size: 13px; color: #ff9800; border-bottom: 1px solid #333;">
                        Control Requests (${requestCount})
                    </div>
                    <div class="wt-scrollbar" style="max-height: 150px; overflow-y: auto;">
                        ${requestsHTML}
                    </div>
                </div>
            `
                    : ""
            }

            ${
                guestCount > 0
                    ? `
                <div>
                    <div style="padding: 12px 15px; font-weight: 600; font-size: 13px; color: #e0e0e0; border-bottom: 1px solid #333;">
                        Connected Guests
                    </div>
                    <div class="wt-guest-list wt-scrollbar" style="max-height: 200px; overflow-y: auto;">
                        ${guestHTML}
                    </div>
                </div>
            `
                    : `
                <div style="padding: 20px; text-align: center; color: #aaa; font-size: 13px;">
                    No guests connected yet
                </div>
            `
            }
        `;

        const guestList = controlPanel.querySelector(".wt-guest-list");
        if (guestList) guestList.scrollTop = prevScroll;

        controlPanelDirty = false;
        console.log("HOST: Control panel updated");
    }

    // Toggle control panel visibility
    function toggleControlPanel() {
        if (!controlPanel) return;

        if (controlPanel.style.display === "none") {
            controlPanel.style.display = "block";
            if (controlPanelDirty) updateControlPanel();
        } else {
            controlPanel.style.display = "none";
        }
    }

    // Show control panel
    function showControlPanel() {
        if (controlPanel) {
            controlPanel.style.display = "block";
            if (controlPanelDirty) updateControlPanel();
        }
    }

    // Hide control panel
    function hideControlPanel() {
        if (controlPanel) {
            controlPanel.style.display = "none";
        }
    }

    // Global handlers for control panel buttons
    window.delegateControlToGuest = delegateControl;
    window.takeBackControlHandler = takeBackControl;
    window.approveControlRequestHandler = approveControlRequest;
    window.denyControlRequestHandler = denyControlRequest;
    window.removeOfflineGuestHandler = removeOfflineGuest;
    window.toggleControlPanel = toggleControlPanel;
    window.forceSyncGuestsHandler = forceSyncGuests;

    // Show guest status in control bar
    function showGuestStatus(guestCount) {
        // Remove existing status
        const existingStatus = document.querySelector(".guest-status-display");
        if (existingStatus) {
            existingStatus.remove();
        }

        if (guestCount > 0) {
            // Find control bar dynamically
            const currentControlBar = document.querySelector(
                ".control-bar-buttons-container-SWhkU",
            );
            if (!currentControlBar) return;

            const status = document.createElement("div");
            status.className = "guest-status-display";
            status.style.cssText = `
                position: absolute;
                top: -30px;
                right: 10px;
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 1000;
            `;
            status.textContent = `${guestCount} guest(s) connected`;

            const controlBarContainer =
                currentControlBar.closest(".control-bar");
            if (controlBarContainer) {
                controlBarContainer.style.position = "relative";
                controlBarContainer.appendChild(status);
            }
        }
    }

    // Start sync
    function startSync() {
        syncInterval = setInterval(() => {
            if (watchTogetherEnabled) {
                sendHostState();
                updateControlPanel();
            }
        }, 2000); // Send updates every 2 seconds

        sendHostState();
        console.log("HOST: Sync started");
    }

    // Stop sync
    function stopSync() {
        if (syncInterval) {
            clearInterval(syncInterval);
            syncInterval = null;
        }

        const existingStatus = document.querySelector(".guest-status-display");
        if (existingStatus) {
            existingStatus.remove();
        }

        hideGuestBufferingStatus();
        hideGuestBufferingIcon();

        console.log("HOST: Sync stopped");
    }

    // Set up observers
    function setupObservers() {
        if (videoElement) {
            videoStateListeners = [
                "play",
                "pause",
                "waiting",
                "playing",
                "canplay",
            ].map((eventName) => {
                const listener = () => {
                    if (watchTogetherEnabled) {
                        sendHostState();
                    }
                };
                videoElement.addEventListener(eventName, listener);
                return { eventName, listener };
            });

            // Seeked triggers an auto force-sync with a debounce so rapid scrubbing
            // doesn't flood the database with sync commands.
            const seekedListener = () => {
                if (!watchTogetherEnabled) return;
                sendHostState();
                clearTimeout(seekSyncTimer);
                seekSyncTimer = setTimeout(() => {
                    forceSyncGuests();
                }, 500);
            };
            videoElement.addEventListener("seeked", seekedListener);
            videoStateListeners.push({ eventName: "seeked", listener: seekedListener });
        }

        // Observe play/pause button changes
        if (playPauseButton) {
            playPauseObserver = new MutationObserver(() => {
                if (watchTogetherEnabled) {
                    sendHostState();
                }
            });

            playPauseObserver.observe(playPauseButton, {
                attributes: true,
                attributeFilter: ["title"],
            });
        }

        // Observe buffering state changes
        const bufferingLayer = document.querySelector(".buffering-layer-ZZCYp");
        if (bufferingLayer) {
            bufferingObserver = new MutationObserver(() => {
                const currentlyBuffering = isVideoBuffering();
                if (currentlyBuffering !== isBuffering) {
                    isBuffering = currentlyBuffering;
                    if (watchTogetherEnabled) {
                        sendHostState();
                    }
                }
            });

            bufferingObserver.observe(bufferingLayer, {
                attributes: true,
                childList: true,
                subtree: true,
            });
        }

        console.log("HOST: Observers set up");
    }

    // Cleanup function
    function cleanup() {
        if (syncInterval) clearInterval(syncInterval);
        if (playPauseObserver) playPauseObserver.disconnect();
        if (bufferingObserver) bufferingObserver.disconnect();
        if (videoElement) {
            for (const { eventName, listener } of videoStateListeners) {
                videoElement.removeEventListener(eventName, listener);
            }
        }
        videoStateListeners = [];
        if (watchTogetherButton) watchTogetherButton.remove();
        if (settingsButton) settingsButton.remove();
        if (controlPanel) controlPanel.remove();
        hideSettingsPopup();

        const existingStatus = document.querySelector(".guest-status-display");
        if (existingStatus) existingStatus.remove();
        const controlPanelButton = document.querySelector(
            ".control-panel-toggle-button",
        );
        if (controlPanelButton) controlPanelButton.remove();

        hideGuestBufferingStatus();
        hideGuestBufferingIcon();

        isScriptActive = false;
        console.log("HOST: Cleanup complete");
    }

    // Main initialization
    async function initialize() {
        // Load saved configuration first
        loadConfig();

        // Initialize display name (generate if needed, or load saved)
        initializeDisplayName();

        console.log(`HOST User ID: ${USER_ID}`);
        console.log(`Room ID: ${ROOM_ID}`);
        console.log("Share this Room ID with your guest: " + ROOM_ID);

        const firebaseReady = await initializeFirebase();
        if (!firebaseReady) {
            console.log(
                "HOST WARNING: Firebase not configured - user needs to set up Firebase first",
            );
            // Don't return here, let the user configure Firebase through the settings
            // The buttons will be created but Firebase won't be initialized until configured
        }

        // Wait for DOM elements with longer timeout
        const maxAttempts = 60; // Increased from 30 to 60
        let attempts = 0;

        console.log("HOST: Waiting for DOM elements to load...");

        while (!findDOMElements() && attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            attempts++;

            if (attempts % 10 === 0) {
                console.log(
                    `HOST: Still waiting for DOM elements... (${attempts}/${maxAttempts})`,
                );
            }
        }

        // Wait for movie to load (timer shows actual time instead of --:--:--)
        console.log("HOST: Waiting for movie to load...");
        let movieLoadAttempts = 0;
        const maxMovieLoadAttempts = 30; // 30 seconds to wait for movie load

        while (!isMovieLoaded() && movieLoadAttempts < maxMovieLoadAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            movieLoadAttempts++;

            if (movieLoadAttempts % 5 === 0) {
                console.log(
                    `HOST: Waiting for movie to load... (${movieLoadAttempts}/${maxMovieLoadAttempts})`,
                );
            }
        }

        if (movieLoadAttempts >= maxMovieLoadAttempts) {
            console.log("HOST WARNING: Movie load timeout - proceeding anyway");
        } else {
            console.log("HOST: Movie loaded successfully");
        }

        if (attempts >= maxAttempts) {
            console.error(
                "HOST ERROR: Could not find required DOM elements after 60 seconds",
            );
            console.error("HOST ERROR: This might be because:");
            console.error("   1. The video is still loading");
            console.error("   2. Stremio UI has changed");
            console.error("   3. The page structure is different");

            // Try to continue anyway with partial elements
            if (videoElement || controlBar || playPauseButton) {
                console.log(
                    "HOST WARNING: Attempting to continue with partial elements...",
                );
            } else {
                return;
            }
        }

        injectPanelStyles();
        createWatchTogetherButton();
        createControlPanelButton();
        createSettingsButton();
        createControlPanel();
        setupObservers();
        startGuestListener();

        console.log("HOST: Watch Together Script loaded successfully!");
        console.log("Click the orange chat icon to start controlling playback");
        console.log("Share Room ID with guest:", ROOM_ID);
        console.log("Test functions available:");
        console.log(
            "   - testGuestBufferingIcon() - Test the guest buffering icon display",
        );
    }

    // Handle page unload
    window.addEventListener("beforeunload", cleanup);

    // Test function for guest buffering icon
    window.testGuestBufferingIcon = function () {
        console.log("HOST: Testing guest buffering icon...");
        showGuestBufferingIcon(1);
        setTimeout(() => {
            console.log("HOST: Hiding guest buffering icon after 5 seconds...");
            hideGuestBufferingIcon();
        }, 5000);
    };

    // Test function to simulate guest buffering state
    window.testGuestBufferingState = function () {
        console.log("HOST: Simulating guest buffering state...");

        // Find the first guest and simulate them buffering
        const guestIds = Object.keys(guestStates);
        if (guestIds.length > 0) {
            const firstGuestId = guestIds[0];
            console.log("HOST: Simulating buffering for guest:", firstGuestId);

            // Simulate the guest buffering
            guestStates[firstGuestId] = {
                ...guestStates[firstGuestId],
                isBuffering: true,
            };

            // Trigger the check
            checkGuestBuffering();

            // Reset after 5 seconds
            setTimeout(() => {
                console.log("HOST: Resetting guest buffering state...");
                guestStates[firstGuestId] = {
                    ...guestStates[firstGuestId],
                    isBuffering: false,
                };
                checkGuestBuffering();
            }, 5000);
        } else {
            console.log("HOST ERROR: No guests found to simulate buffering");
        }
    };

    // Wait for page to be fully loaded before initializing
    function waitForPageLoad() {
        return new Promise((resolve) => {
            if (document.readyState === "complete") {
                resolve();
            } else {
                window.addEventListener("load", resolve);
            }
        });
    }

    // Start initialization
    async function startInitialization() {
        console.log("HOST: Starting initialization...");

        // Wait for page load
        await waitForPageLoad();
        console.log("HOST: Page loaded");

        // Wait a bit more for Stremio to initialize
        await new Promise((resolve) => setTimeout(resolve, 3000));
        console.log("HOST: Waiting period complete");

        // Start the main initialization
        await initialize();
    }

    // Start initialization
    // Start initialization
    // startInitialization().catch(error => {
    //     console.error('HOST ERROR: Initialization failed:', error);
    // });

    // URL Change Detection and Lifecycle Management
    let lastUrl = window.location.href;

    async function checkUrlAndManageState() {
        const currentUrl = window.location.href;
        const isPlayerPage = currentUrl.includes("#/player/");

        if (isPlayerPage) {
            if (!isScriptActive && !isInitializationRunning) {
                console.log(
                    "HOST: Player page detected, initializing Watch Together...",
                );
                isInitializationRunning = true;

                try {
                    // Start initialization flow
                    await startInitialization(); // This calls initialize() which sets up everything
                    isScriptActive = true;
                } catch (error) {
                    console.error("HOST ERROR: Failed to initialize:", error);
                    // Reset flags so we can retry if needed
                    isScriptActive = false;
                } finally {
                    isInitializationRunning = false;
                }
            }
        } else {
            if (isScriptActive) {
                console.log("HOST: Left player page, cleaning up...");
                cleanup();
                // isScriptActive is set to false in cleanup(), but ensuring it here too
                isScriptActive = false;
            }
        }

        lastUrl = currentUrl;
    }

    // Interval to check for URL changes (robust for SPA)
    // Check every 1 second
    setInterval(checkUrlAndManageState, 1000);

    // Initial check
    checkUrlAndManageState();

    // Also listen for popstate just in case
    window.addEventListener("popstate", () => {
        setTimeout(checkUrlAndManageState, 100);
    });
})();
