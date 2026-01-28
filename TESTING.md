# Quick Start - Testing Your Updates

## Opening the App
1. Open `index.html` in your web browser
2. Check the browser console (F12 → Console tab) for any errors

## Testing Each Feature

### 1. Global Margin Toggle ✓
- **Location**: Header, next to Undo/Redo buttons
- **Test**: 
  1. Click checkbox "Margin %" → Cost basis fields should disappear in all packages
  2. Add values to cost basis (they're still stored)
  3. Click checkbox again → Values should reappear
  4. Reload page → Checkbox state should be preserved

### 2. Dropdown Menu ✓
- **Location**: Header, menu button (⋮) to the right of "Margin %"
- **Contains**:
  - Download CSV
  - Save as Template  
  - Download JSON
  - Upload JSON
  - Reset All
- **Test**:
  1. Click menu button → Should see dropdown
  2. Click outside → Menu should close
  3. Click button again → Menu should toggle
  4. Click an action → Should execute

### 3. Project Library Section ✓
- **Location**: Below the Global Markup section
- **Contains**:
  1. Load Template (dropdown) - populated with saved templates
  2. Load Client Project (dropdown) - shows client names
  3. Project (dropdown) - appears after selecting client
  4. Save to Client (button)

- **Test**:
  1. Add some items to packages
  2. Change "Save to Client" text → Enter a client name
  3. Go to "Load Client Project" → Should see client in dropdown
  4. Select client → "Project" dropdown should appear with dates
  5. Select a project → Should load that client's pricing

### 4. Save Template ✓
- **Location**: Click menu (⋮) → "Save as Template"
- **Test**:
  1. Add some items to packages
  2. Click menu → "Save as Template"
  3. Enter a template name (e.g., "Web Design")
  4. Go to "Project Library" → "Load Template" dropdown
  5. Should see your template listed
  6. Click Reset All to clear everything
  7. Load template from dropdown → Pricing should be restored

## Keyboard Shortcuts
- **Ctrl+Z** or **Cmd+Z** - Undo
- **Ctrl+Shift+Z** or **Cmd+Shift+Z** - Redo
- **Ctrl+Y** or **Cmd+Y** - Redo (alternative)

## Troubleshooting

### Cost basis fields not hiding
- Make sure "Margin %" checkbox in header is unchecked
- Check browser console for JavaScript errors

### Dropdown menu not showing
- Make sure you're clicking the ⋮ button in the header
- Check that JavaScript is enabled

### Templates not appearing in dropdown
- Make sure you saved a template (prompt should appear)
- Check browser localStorage is enabled

### Two-level client selector not working
- Select a client from "Load Client Project" dropdown first
- "Project" dropdown should then appear below it
- Make sure you've saved at least one client project

## Files Modified
- `index.html` - Header and Project Library section
- `js/app.js` - Event listeners, state management, client selector logic
- `css/styles.css` - New styles for dropdown menu, margin toggle, library controls
- `CHANGES.md` - Detailed change documentation (optional reference)

## Backup
Your app is automatically saving to browser localStorage. No action needed!

To backup your data:
1. Click menu (⋮) → "Download JSON"
2. Save the file to your computer
3. To restore: Click menu (⋮) → "Upload JSON" → Select saved file
