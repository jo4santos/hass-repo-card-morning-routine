# Morning Routine Card

A beautiful, kid-friendly custom Lovelace card for displaying and interacting with the Morning Routine Gamification integration.

## Features

- **Dual-child display**: Show progress for multiple children side-by-side or stacked
- **Visual progress rings**: Circular progress indicators with percentage
- **Activity grid**: Colorful, icon-based activity tiles
- **Camera capture**: Built-in camera modal for taking photos (HTTPS required)
- **Reward display**: Show AI-generated reward images when routines are complete
- **Interactive**: Click activities to mark them complete
- **Responsive**: Works on tablets, desktops, and mobile devices
- **Customizable**: Configure colors, layout, and display options

## Requirements

- Home Assistant 2023.1.0 or newer
- Morning Routine Gamification integration installed
- HTTPS enabled (for camera capture feature)

## Installation

### Via HACS (Recommended)

1. Open HACS in your Home Assistant instance
2. Go to "Frontend"
3. Click the three dots menu (top right)
4. Select "Custom repositories"
5. Add this repository URL: `https://github.com/jo4santos/hass-repo-card-morning-routine`
6. Category: Lovelace
7. Click "Add"
8. Click "Install" on the Morning Routine Card
9. Refresh your browser (hard refresh: Ctrl+F5 / Cmd+Shift+R)

### Manual Installation

1. Copy `morning-routine-card.js` to `/config/www/morning-routine-card.js`
2. Add the card as a resource in your dashboard:
   - Go to **Settings** → **Dashboards** → **Resources**
   - Click **Add Resource**
   - URL: `/local/morning-routine-card.js`
   - Resource type: JavaScript Module
3. Refresh your browser

## Configuration

### Basic Example

```yaml
type: custom:morning-routine-card
children:
  - entity: sensor.duarte_morning_status
    name: Duarte
    color: "#4CAF50"
  - entity: sensor.leonor_morning_status
    name: Leonor
    color: "#2196F3"
```

### Full Example

```yaml
type: custom:morning-routine-card
children:
  - entity: sensor.duarte_morning_status
    name: Duarte
    color: "#4CAF50"
  - entity: sensor.leonor_morning_status
    name: Leonor
    color: "#2196F3"
layout: horizontal  # or "vertical"
show_progress: true
compact: false
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `children` | list | **required** | List of children to display |
| `children[].entity` | string | **required** | Entity ID of child's morning status sensor |
| `children[].name` | string | **required** | Child's display name |
| `children[].color` | string | `#4CAF50` | Border and progress ring color (hex code) |
| `layout` | string | `horizontal` | Card layout: `horizontal` or `vertical` |
| `show_progress` | boolean | `true` | Show progress rings in headers |
| `compact` | boolean | `false` | Use compact grid layout |

## Usage

### Completing Activities

1. **Click an activity tile** to mark it as complete
2. **Camera-required activities** (Getting Dressed):
   - Opens camera modal
   - Take a photo
   - Photo is saved and activity marked complete
3. **NFC-tagged activities** (Bags):
   - Scan NFC tag with phone
   - Activity automatically completes
   - No card interaction needed

### Viewing Rewards

When a child completes all activities:
1. AI-generated reward image appears in their section
2. Click the reward to view full-screen
3. Celebration message displays

### Color Customization

Use different colors for each child to make the card more personalized:

```yaml
children:
  - entity: sensor.duarte_morning_status
    name: Duarte
    color: "#4CAF50"  # Green
  - entity: sensor.leonor_morning_status
    name: Leonor
    color: "#E91E63"  # Pink
```

Popular color options:
- Green: `#4CAF50`
- Blue: `#2196F3`
- Purple: `#9C27B0`
- Pink: `#E91E63`
- Orange: `#FF9800`
- Teal: `#009688`

## Layout Options

### Horizontal Layout (Side-by-Side)

Best for desktop/landscape tablets:

```yaml
layout: horizontal
```

### Vertical Layout (Stacked)

Best for mobile/portrait tablets:

```yaml
layout: vertical
```

## Camera Feature

The card includes a built-in camera capture feature for the "Getting Dressed" activity:

### Requirements

- **HTTPS**: Camera access requires a secure connection
  - Use Nabu Casa Cloud
  - Or set up Let's Encrypt certificate
  - Or access via `localhost` for testing

### How It Works

1. Click "Getting Dressed" activity
2. Browser prompts for camera permission (first time only)
3. Camera preview appears
4. Click "Capture" to take photo
5. Photo is saved to Home Assistant
6. Activity is marked complete

### Troubleshooting Camera

**"Could not access camera" error:**
- Verify HTTPS is enabled
- Check browser camera permissions (Settings → Privacy)
- Try a different browser (Chrome/Safari recommended)
- Check Home Assistant logs for errors

## Styling & Theming

The card respects your Home Assistant theme:
- Card background color
- Text colors
- Primary colors

Custom CSS can be applied via `card-mod`:

```yaml
type: custom:morning-routine-card
card_mod:
  style: |
    .child-header h2 {
      font-family: 'Comic Sans MS', cursive;
    }
children:
  - entity: sensor.duarte_morning_status
    name: Duarte
    color: "#4CAF50"
```

## Example Dashboards

### Full-Screen Tablet Dashboard

```yaml
views:
  - title: Morning Routine
    path: morning
    type: panel
    cards:
      - type: custom:morning-routine-card
        children:
          - entity: sensor.duarte_morning_status
            name: Duarte
            color: "#4CAF50"
          - entity: sensor.leonor_morning_status
            name: Leonor
            color: "#2196F3"
        layout: horizontal
```

### Mobile Dashboard

```yaml
views:
  - title: Morning
    cards:
      - type: custom:morning-routine-card
        children:
          - entity: sensor.duarte_morning_status
            name: Duarte
            color: "#4CAF50"
          - entity: sensor.leonor_morning_status
            name: Leonor
            color: "#2196F3"
        layout: vertical
        compact: true
```

### With Header Card

```yaml
type: vertical-stack
cards:
  - type: markdown
    content: |
      # 🌅 Good Morning!
      Complete your routine to earn a reward!

  - type: custom:morning-routine-card
    children:
      - entity: sensor.duarte_morning_status
        name: Duarte
        color: "#4CAF50"
      - entity: sensor.leonor_morning_status
        name: Leonor
        color: "#2196F3"
```

## Browser Compatibility

Tested and working on:
- ✅ Chrome/Edge (desktop & mobile)
- ✅ Safari (desktop & mobile)
- ✅ Firefox (desktop & mobile)
- ✅ Home Assistant Companion App

Camera feature requires:
- Chrome 53+
- Safari 11+
- Firefox 36+

## Performance

- Lightweight: ~20KB JavaScript
- No external dependencies (uses Lit from CDN)
- Efficient updates: Only re-renders when entity states change
- Smooth animations: CSS-based, no JavaScript animation

## Privacy

- All data stays local to your Home Assistant instance
- Camera stream is never uploaded or stored (only captured photos)
- No tracking or analytics
- No external API calls

## Support

For issues, feature requests, or questions:
- GitHub Issues: https://github.com/jo4santos/hass-repo-card-morning-routine/issues
- Community Forum: https://community.home-assistant.io/

## Screenshots

### Horizontal Layout
![Horizontal Layout](screenshots/horizontal.png)

### Vertical Layout
![Vertical Layout](screenshots/vertical.png)

### Camera Capture
![Camera Capture](screenshots/camera.png)

### Reward Display
![Reward Display](screenshots/reward.png)

## License

Apache License 2.0

## Credits

Developed by [@jo4santos](https://github.com/jo4santos) as part of the Morning Routine Gamification project.

Built with [Lit](https://lit.dev/) ❤️
