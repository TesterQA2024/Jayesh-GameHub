# 🚇 Metro Dash 3D

> A cyberpunk-themed 3D endless runner built from scratch with Three.js.
> Original concept — no copyrighted assets, characters, or IP from other games.

---

## 🎮 Play

Just open `index.html` in a modern browser. **No server needed** for local play.

For deployment (to avoid CORS on fonts), serve via any HTTP server:

```bash
# Python
python -m http.server 8000

# Node.js
npx serve .

# VS Code
Use the "Live Server" extension
```

---

## 🕹️ Controls

| Action       | Keyboard         | Mobile      |
|--------------|------------------|-------------|
| Move Left    | ← Arrow / A      | Swipe Left  |
| Move Right   | → Arrow / D      | Swipe Right |
| Jump         | ↑ Arrow / W / Space | Swipe Up |
| Slide        | ↓ Arrow / S      | Swipe Down  |
| Pause        | Escape / P       | Pause button |

---

## 🏗️ Project Structure

```
metrodash/
├── index.html        Main HTML with all UI screens (HUD, menus, game over)
├── style.css         Cyberpunk dark-neon UI (Orbitron + Rajdhani fonts)
├── main.js           Complete game logic (Three.js r128, ~700 lines)
├── assets/           (Reserved for future sprites/textures)
│   └── sounds/       (Reserved – sounds generated via Web Audio API)
└── README.md         This file
```

---

## ✨ Features

| Feature | Implementation |
|---------|---------------|
| **3D Environment** | Three.js scene, fog, shadows, lighting |
| **Cyberpunk Design** | Neon cyan/magenta palette, dark surfaces, glowing edges |
| **Player Character** | Original angular android with run/jump/slide animations |
| **3 Obstacle Types** | Barrier (jump), Train (dodge), Overhead beam (slide) |
| **Coin System** | Spinning gold coins with particle burst on collection |
| **Increasing Difficulty** | Speed ramps up every 450 score points |
| **Smart Spawning** | 6 weighted patterns, difficulty-adjusted ratios |
| **Particle Effects** | Gold burst on coin collect, red crash explosion |
| **Camera** | Smooth follow with jump tilt and lane lean |
| **Background Music** | Procedural 128BPM cyberpunk beat (Web Audio API) |
| **Sound Effects** | Jump, land, coin, lane switch, crash — all synthesized |
| **High Score** | Persisted via localStorage |
| **Responsive** | Works on desktop + mobile with touch swipe |
| **60 FPS** | Object pooling, minimal GC, delta-time physics |

---

## 🎨 Design Language

- **Aesthetic**: Cyberpunk metro/elevated rail platform at night
- **Colors**: Deep navy + electric cyan (#00f5ff) + neon magenta + amber orange
- **Fonts**: Orbitron (HUD/UI) + Rajdhani (body text)
- **Obstacles**: 
  - 🟧 Concrete barriers with orange warning stripes → JUMP
  - 🔴 Dark metro trains with headlights and route boards → DODGE
  - 🔵 Overhead structural beams with cyan under-glow → SLIDE
- **Environment**: Elevated track, background city silhouette, star field

---

## 🔧 Customization

### Speed & Difficulty

Edit `CFG` in `main.js`:
```javascript
INIT_SPEED:     14,      // Starting speed
MAX_SPEED:      42,      // Maximum speed cap
SPEED_STEP:     1.0,     // Speed added per increase
SCORE_INTERVAL: 450,     // Score gap between speed increases
```

### Adding Sound Files

Replace the `playSound()` function's Web Audio synthesis with actual audio files:
```javascript
const sounds = {
  jump:  new Audio('./assets/sounds/jump.mp3'),
  coin:  new Audio('./assets/sounds/coin.mp3'),
  crash: new Audio('./assets/sounds/crash.mp3'),
};
function playSound(type) {
  sounds[type]?.play().catch(() => {});
}
```

---

## 🌐 Deploy to Vercel / Netlify

Static site — just drag the folder to Netlify or run:
```bash
vercel .
```

No build step required.

---

## 📦 Dependencies

- [Three.js r128](https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js) — loaded via CDN
- [Google Fonts: Orbitron + Rajdhani](https://fonts.google.com/) — loaded via CDN
- Zero npm packages

---

**Metro Dash 3D** — Original game concept. Run fast. Dash harder.
