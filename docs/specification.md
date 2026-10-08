# Game Specification: Genesis (2D Jump-and-Run)

## 1. Overview & Objective

* **Project Name:** Genesis
* **Purpose:** Live demonstration of an AI-based coding workflow for rapid, functional game development.
* **Concept:** A straightforward 2D jump-and-run game where the player navigates through obstacles and reaches the goal before the timer expires.

## 2. Technical Stack & Target Platform

* **Architecture:** Pure Client-Side HTML5 Application.
* **Technologies:**
  * HTML5 `<canvas>` for rendering.
  * Vanilla JavaScript (ES6+, Object-Oriented or Module-based, **no** external game engines like Phaser).
  * Vanilla CSS / Tailwind CSS for UI overlays (timer, score, start/end screens).
* **Target Platform:** Desktop PC browsers only (Chrome, Firefox, Safari, Edge). No touch or mobile support required.

## 3. Player Character (Hero)

* **Rendering:** Generated purely procedurally via the Canvas API (no external spritesheets/image files).
* **Visual Design:**
  * Geometric shape (e.g., a glowing, rounded square or polygon).
  * Optional visual details: Subtle inner shadow, eyes/expression drawn using simple lines/shapes.
* **States:**
  * *Normal:* Standard height (e.g., $40 \times 40$ pixels).
  * *Crouched:* Reduced height (e.g., $40 \times 20$ pixels) to slide under low obstacles.

## 4. Controls (Desktop)

* **WASD Layout:**
  * `A`: Move left
  * `D`: Move right
  * `W`: Jump (Physics: upward impulse + gravity)
  * `S`: Crouch (halves hitbox height, reduces movement speed)

## 5. Game Mechanics & Level Design

### 5.1 Movement & Physics

* **Gravity:** Constant downward acceleration.
* **Speed:** Fixed horizontal movement speed; reduced speed while crouching.
* **Jump Mechanics:** Only allowed when the player is standing on the ground or a platform (*Ground Check*).

### 5.2 Level Structure

* **Scrolling:** Horizontal side-scroller (camera follows the player).
* **Elements:**
  * Ground and solid platforms at varying heights.
  * **Low Obstacles:** Require crouching (`S`).
  * **High Obstacles / Pits:** Require jumping (`W`).
  * **Goal Area:** Finish marker (e.g., a glowing pillar or flag) at the end of the level.

### 5.3 Time Limit & Conditions

* **Timer:** Countdown set to **180 seconds (3 minutes)** per level.
* **Win Condition:** Reaching the goal area before the timer reaches 0.
* **Game Over Condition:**
  * Timer reaches 0 seconds.
  * Falling into a pit / collision with lethal obstacles (hazards/bugs).

### 5.4 Collision Detection

* **Method:** Axis-Aligned Bounding Box (AABB) collision testing.
* Collision checks for:
  * Solid blocks (landing on top and blocking horizontal movement).
  * Lethal hazards (Game Over trigger).
  * Goal area (Win trigger).

## 6. Visuals & Assets (Code-Driven)

* **Asset Policy:** 100% no-asset setup. No external `.png`, `.jpg`, or `.svg` files.
* **Canvas Styling:**
  * Color Palette: Modern cyber/genesis theme (e.g., dark background with neon accents for platforms and the hero).
  * Background: Procedural CSS/Canvas grids or color gradients.

## 7. Project & Folder Structure (for Cloud Code)

The application uses a minimalist setup to ensure maximum compatibility and immediate execution:

```
/genesis-game
│
├── index.html     # HTML layout, canvas element, UI overlays
├── style.css      # Layout, fonts, UI styling
└── game.js        # Game logic, physics engine, render loop, input handling
```