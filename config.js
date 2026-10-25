/* ==========================================================================
   config.js  —  ALL YOUR PERSONAL CONTENT LIVES HERE
   --------------------------------------------------------------------------
   Edit this file to change the text, colors, speed, collectibles and the
   character sprite. You should rarely need to touch main.js.

   Tips:
   - Text goes inside quotes: "like this". If your text has a " inside it,
     use single quotes around it instead: 'She said "hi"'.
   - Every item in a list ends with a comma.
   - After saving, refresh the browser tab to see your changes.
   - If the screen goes blank, open the browser console (F12 / Cmd+Opt+I)
     — a typo here (like a missing comma) will be reported there.
   ========================================================================== */

window.GAME_CONFIG = {

  /* ------------------------------------------------------------------
     1. TITLE SCREEN
     ------------------------------------------------------------------ */
  title: "Happy Birthday, Taru",
  subtitle: "a tiny game made just for your birthday",

  /* ------------------------------------------------------------------
     2. SMALL UI TEXTS
     ------------------------------------------------------------------ */
  text: {
    startPrompt: "Press SPACE or tap to start",
    startHint: "Find all the memories hidden around town!",
    keyboardHint: "Move with Arrow keys or WASD, hold SHIFT to run",
    touchHint: "Touch and drag anywhere to move",
    continueHint: "tap or press SPACE to continue",
    counterLabel: "",          // e.g. "Memories " -> shows "Memories 3 / 8"
    playAgain: "Play again",
  },

  /* ------------------------------------------------------------------
     3. COLLECTIBLES  (6–8 recommended, but any number works)
     ------------------------------------------------------------------
     title   – heading of the popup
     message – the text shown when it's picked up (keep it to ~2–3 sentences)
     icon    – "heart", "star", "letter" or "flower"
     x, y    – position on the map in pixels (map size is set in `world`).
               Leave x/y out and the game will pick a random free spot.
               Tip: walk somewhere in the game and press P — the game
               shows the player's x/y so you can copy it here.
  */
  collectibles: [
    // In the garden, just past the start
    { title: "First Glance", icon: "heart", x: 560, y: 470,
      message: "I still remember seeing you for the first time and thinking to myself, " +
               "\"I have never seen someone so pretty.\" You were so beautiful that the only " +
               "thought that came to mind was... I'm in heaven. I still feel the same." },
    // At the mall entrance
    { title: "Seeing You in Person", icon: "star", x: 1660, y: 634,
      message: "That day at the mall was the best day of my year. You looked even prettier " +
               "than you did on screen. I was in awe and couldn't stop looking at you. " +
               "You probably don't know this, but I watched you more than the movie, " +
               "out of the corner of my eye." },
    // On the street corner between the houses
    { title: "Pick Me Up", icon: "heart", x: 1425, y: 800,
      message: "Picking you up and holding you for the first time was overwhelming for me. " +
               "I can still feel you in my arms, and seeing you so happy made my whole day. " +
               "Ever since, I've been trying to find ways to pick you up again." },
    // In front of the café
    { title: "The First Date", icon: "flower", x: 1300, y: 634,
      message: "That pink top during the day and that black dress at night... probably the " +
               "best day of my life. THE BEST DATE EVERRRRR. I will always cherish that day. " +
               "Being part of your life has been pure bliss. You are amazing." },
    // Up in the garden
    { title: "Your Taste", icon: "star", x: 800, y: 300,
      message: "I love your taste. I'll always remember the alternate reality videos and " +
               "the left-right game. OMG, that was a dream come true! " +
               "I love how much our tastes match." },
    // On the bench by the pond (the letter = my little list about you)
    { title: "Your Talks", icon: "letter", x: 780, y: 1010,
      message: "To be honest, there have been times when I was staring at you while we talked " +
               "and got so intoxicated by the view that I couldn't pay attention to the words. " +
               "But I remember my baby's stuff, so I started writing down everything I should " +
               "know about you. I'm still adding to that list whenever I find something worth noting." },
    // In the quiet corner past the houses
    { title: "Your Presence", icon: "heart", x: 2080, y: 1100,
      message: "Your presence is what I miss the most. When I'm with you, I feel like a cat " +
               "with the zoomies. You are so radiant and so interesting that I can't help " +
               "falling for you again and again. I can't imagine living without you. Since you " +
               "came into my life, it has been sooo much fun and so amazing, more than I can ever express." },
  ],

  /* ------------------------------------------------------------------
     4a. BIRTHDAY CAKE (after the last memory, before the ending)
     ------------------------------------------------------------------ */
  cake: {
    enabled: true,             // false = skip straight to the ending
    candles: 5,
    wishText: "Make a wish, Taru...",
    blowHint: "press SPACE or tap to blow out the candles",
    celebrateText: "Happy Birthday, Taru!",
  },

  /* ------------------------------------------------------------------
     4b. ENDING SCREEN (shown after everything is collected)
     ------------------------------------------------------------------ */
  ending: {
    title: "Happy Birthday, Taru!",
    // Tip: put \n inside the text to start a new line.
    message: "You found every memory, but the truth is, you are my favorite memory of all.\n" +
             "Thank you for every glance, every laugh and every moment with you.\n" +
             "Here's to your special day, and to so many more adventures together.",
    signature: "— with all my love, always",
  },

  /* ------------------------------------------------------------------
     5. PLAYER CHARACTER
     ------------------------------------------------------------------ */
  player: {
    speed: 170,                // walking speed in pixels per second
    runMultiplier: 1.8,        // holding SHIFT moves this many times faster

    // false = use the built-in placeholder kitty
    // true  = use YOUR Aseprite sprite sheet below (see README)
    useCustomSprite: true,

    customSprite: {
      image: "player.png",   // the PNG exported from Aseprite
      json:  "player.json",  // the JSON exported with it (Array or Hash both work)
      idleTag: "idle",         // name of the Aseprite tag for standing still
      walkTag: "walk",         // name of the Aseprite tag for walking (one animation, mirrored for left)
      // Optional: a separate walk tag for each direction (upper/lower case doesn't matter).
      // Used instead of walkTag when all four exist in your Aseprite file.
      walkTags: { right: "walk right", left: "walk left", up: "walk up", down: "walk down" },
      walkWaddle: 5,           // degrees of side-to-side wobble while walking (0 = off)
      scale: 2,                // 2 = draw it twice as big (good for small pixel art)
      pixelArt: true,          // true = keep pixels sharp (no blur)
      facesLeft: false,        // set true if you drew the character facing LEFT
    },

    // Collision box at the character's feet, as a fraction of the frame size.
    // Turn on debug.showHitboxes below to see it.
    hitbox: { width: 0.5, height: 0.28, bottomGap: 0.06 },

    // Colors of the placeholder kitty (ignored when useCustomSprite is true)
    placeholderColors: {
      body: "#fff7f2",
      accent: "#f9a8c9",       // inner ears + scarf
      blush: "#ffc6d9",
      outline: "#5b4a5e",
    },
  },

  /* ------------------------------------------------------------------
     6. THE MAP
     ------------------------------------------------------------------ */
  // The left part of the map is the garden; the town (roads, mall, café,
  // houses) is on the right, past the road at x ≈ 1100.
  world: {
    width: 2200,
    height: 1300,
    playerStart: { x: 200, y: 660 },
    trees: 22,                 // random trees inside the map (plus a border of trees)
    flowers: 240,              // little decorative flowers
    seed: "our-secret-seed",   // change this to get a different random layout
    collectRadius: 38,         // how close you need to be to pick something up
  },

  /* ------------------------------------------------------------------
     7. COLORS  (any CSS hex color, e.g. "#ffccdd")
     ------------------------------------------------------------------ */
  colors: {
    background: "#fde8ef",     // title / ending screen background
    text: "#6b5070",
    textSoft: "#a78aa8",
    accent: "#e9799f",         // titles, buttons
    accentDark: "#c95c84",
    panel: "#fffaf5",          // popup + HUD background
    panelBorder: "#f6bcd0",
    overlay: "#6b5070",        // dim layer behind popups

    grass: "#cdeccf",
    grassDark: "#b5dfbc",
    path: "#f8ead6",
    water: "#bfe3f5",
    waterEdge: "#9fd0ea",

    treeLeaves: "#a8d8b0",
    treeLeavesLight: "#c9ecc8",
    treeLeavesDark: "#86c296",
    treeTrunk: "#c9a27e",
    treeOutline: "#6e8b74",
    blossom: "#ffb7cf",

    flowers: ["#ffb7cf", "#d9c3f5", "#fff4b8", "#ffffff"],

    heart: "#ff8fb3",
    star: "#ffd66b",
    letter: "#fffaf0",
    itemOutline: "#8a5a74",

    // Town
    road: "#c3bccb",
    roadLine: "#fff8e1",
    sidewalk: "#f3eae6",
    sidewalkEdge: "#ddd0d4",
    buildingOutline: "#7a6378",
    glass: "#cfeaff",
    wood: "#c9a27e",
    mallWall: "#e4d7f5",
    mallRoof: "#b9a2e3",
    cafeWall: "#ffe6ee",
    cafeRoof: "#d987a6",
    cafeAwning: "#f48fb1",
    shopWall: "#e5f5e3",
    shopAwning: "#8fd0a5",
    houseWalls: ["#fff3d6", "#e3f1fb", "#fde2e2"],
    houseRoofs: ["#e89a8f", "#8fb4d9", "#c59ad9"],
    chimney: "#d79a8a",
    cars: ["#ff9fb8", "#9fd3f5", "#ffd98a", "#b8e6b0"],
    balloons: ["#ff8fb3", "#ffd66b", "#9fd3f5", "#c9a7f5", "#ffffff"],
    butterflies: ["#ffffff", "#ffd6e7", "#fff4b8", "#d9c3f5"],
  },

  /* ------------------------------------------------------------------
     8. FONT  (loaded from Google Fonts in index.html)
     ------------------------------------------------------------------ */
  ui: {
    fontFamily: '"Fredoka", "Trebuchet MS", sans-serif',
  },

  /* ------------------------------------------------------------------
     9. SOUND
     ------------------------------------------------------------------
     By default the game plays a soft built-in melody and chimes, so you
     don't need any audio files. To use your own song, put an .mp3 in
     assets/audio/ and set musicFile: "assets/audio/song.mp3".
     Players can always mute with the speaker button or the M key.
  */
  audio: {
    music: true,               // false = no background music at all
    musicVolume: 0.45,         // 0.0 – 1.0
    sfxVolume: 0.7,            // 0.0 – 1.0
    musicTempo: 84,            // beats per minute of the built-in melody
    musicFile: null,           // e.g. "assets/audio/our-song.mp3"
    collectSoundFile: null,    // e.g. "assets/audio/pop.mp3"
  },

  /* ------------------------------------------------------------------
     10. CONTROLS & DEBUG HELPERS
     ------------------------------------------------------------------ */
  controls: {
    joystick: true,            // touch/drag-to-move joystick (phones + mouse)
  },
  debug: {
    showHitboxes: false,       // true = draw collision boxes (useful when tuning hitbox)
    positionHelper: true,      // press P in game to show the player's x/y
  },
};
