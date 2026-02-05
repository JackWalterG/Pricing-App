# Testing Guide - New Features

## Feature Testing Checklist

### ✅ 1. Custom Markup Per Package Element

**Test Steps:**
1. Create an Hour-Based deliverable
2. Click "Add Package Element"
3. You should see:
   - Role Preset dropdown at the top
   - Name and Hours fields
   - Three fields: Cost/hr, Sell/hr, Markup %
   - Checkbox: "Use custom markup (overrides global)"
   
**Test Custom Markup:**
1. Enter values:
   - Cost: $100
   - Hours: 10
2. Check "Use custom markup"
3. Enter Markup %: 30
4. Verify: Sell rate should automatically calculate to $130
5. Try editing Sell rate to $150
6. Verify: Markup % should recalculate to 50%
7. Look for orange badge showing "Custom 50.0%" with hover tooltip
8. Click "Reset to Global" button
9. Verify: Custom markup is disabled, sell rate syncs with cost rate

**Test Global Markup Independence:**
1. Enable custom markup on one element (e.g., 30%)
2. Add another element without custom markup
3. Change global markup (header) from 20% to 40%
4. Verify:
   - Element WITH custom markup stays at 30%
   - Element WITHOUT custom markup changes to 40%

---

### ✅ 2. Package Element Duplication

**Test Steps:**
1. Create a package element with:
   - Name: "Sr. Editor"
   - Cost: $150/hr
   - Hours: 8
   - Custom markup: 25%
2. Click the "Duplicate" button (⧉ icon)
3. Verify:
   - New element created with name "Sr. Editor (Copy)"
   - All fields copied (cost, hours, custom markup %)
   - New element is separate and editable

---

### ✅ 3. Industry Role Presets

**Test Steps:**
1. Create a new package element
2. Click the "Role Preset" dropdown
3. You should see:
   - Industry Standard Roles section with 10 roles
   - Each showing: Role name - $XX/hr ($XXX/day)
4. Select "Director - $185/hr ($1,850/day)"
5. Verify auto-population:
   - Name: "Director"
   - Cost/hr: $185
   - Sell/hr: $185
   - Hours: 10
6. Try selecting different presets to verify all work

**Available Presets:**
- Producer: $105/hr
- Director: $185/hr
- Camera Operator: $90/hr
- Gaffer: $78/hr
- Sound Mixer: $90/hr
- Editor: $93/hr
- Sr. Editor: $150/hr
- Colorist: $175/hr
- Sound Designer: $115/hr
- Retoucher: $80/hr

---

### ✅ 4. Manage Presets Interface

**Test Steps:**
1. Click "Manage Presets" button in header
2. Modal should open showing:
   - Industry Standard Roles (read-only list)
   - Custom Roles section with "+ Add New" button

**Add Custom Role:**
1. Click "+ Add New"
2. Enter prompts:
   - Role name: "Junior Developer"
   - Hourly rate: 75
   - Full day rate: 600 (optional)
   - Default hours: 8
3. Verify custom role appears in list
4. Close modal
5. Create new package element
6. Open Role Preset dropdown
7. Verify "Junior Developer" appears under "Custom Roles" section

**Edit Custom Role:**
1. Open Manage Presets
2. Find your custom role
3. Click "Edit" button
4. Modify values
5. Verify changes saved

**Delete Custom Role:**
1. Open Manage Presets
2. Click "Delete" on a custom role
3. Confirm deletion
4. Verify role removed from both modal and dropdown

---

### ✅ 5. CSV Export with New Fields

**Test Steps:**
1. Create project with package elements (some with custom markup)
2. Click menu (⋮) → "Download CSV"
3. Open CSV file
4. Verify "Package Elements" section includes:
   - Cost Rate column
   - Sell Rate column
   - Custom Markup column (shows "Yes (XX%)" or "No (Global XX%)")
   - Enhanced calculation details

---

### ✅ 6. JSON Import/Export & Backward Compatibility

**Test Old Data Migration:**
1. Download a current project as JSON (for backup)
2. Edit the JSON file manually:
   - Rename `packageElements` to `teamMembers`
   - Rename `costRate` to `hourlyRate`
   - Remove `sellRate`, `useCustomMarkup`, `customMarkupPercent`
3. Upload the modified JSON
4. Verify:
   - Loads successfully
   - Old `teamMembers` converted to `packageElements`
   - Old `hourlyRate` becomes both `costRate` and `sellRate`
   - No errors or data loss

**Test New Data Format:**
1. Create project with custom markup
2. Download JSON
3. Upload JSON to fresh browser/incognito window
4. Verify all custom markup settings preserved

---

### ✅ 7. Template System with Cost Rates

**Test Steps:**
1. Create package elements with cost/sell rates
2. Save as template
3. Create new project
4. Load template
5. Verify:
   - Cost rates preserved
   - Sell rates preserved
   - Custom markup settings preserved

---

### ✅ 8. Client History with New Features

**Test Steps:**
1. Create project with custom markup elements
2. Save to client
3. Load different client project
4. Load original client project back
5. Verify custom markup settings restored

---

## Visual/UX Checks

### Package Element Card Layout
- [ ] Role preset dropdown clearly visible at top
- [ ] Custom markup badge (orange) appears when enabled
- [ ] Three fields (Cost/Sell/Markup) properly aligned
- [ ] Duplicate and Remove buttons visible at bottom
- [ ] Custom markup checkbox easy to find
- [ ] Reset button appears ONLY when custom markup enabled

### Responsive Design
- [ ] Three-field layout stacks on mobile
- [ ] Buttons remain accessible on small screens
- [ ] Modal scrolls properly on mobile
- [ ] Dropdowns work on touch devices

### Calculations
- [ ] Summary shows correct Base, Markup, Total
- [ ] Package totals include all elements correctly
- [ ] Inherited packages (Better, Best) calculate correctly
- [ ] Global markup doesn't affect custom markup elements

---

## Edge Cases to Test

1. **Empty state**: Package element with no values
2. **Zero cost**: Cost rate = 0, verify no division errors
3. **Negative values**: Try entering negative rates (should prevent or handle)
4. **Very high markup**: 500%+ markup percentage
5. **Duplicate empty element**: Duplicate before filling in values
6. **Rapid switching**: Toggle custom markup on/off rapidly
7. **Many custom roles**: Add 20+ custom roles, verify dropdown scrolls
8. **Long role names**: Very long names in custom roles
9. **Special characters**: Role names with emojis, symbols
10. **Browser refresh**: Verify localStorage persistence

---

## Browser Compatibility

Test in:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

---

## Performance Checks

- [ ] No lag when adding many elements (20+)
- [ ] Dropdown loads instantly even with many custom roles
- [ ] Calculations update smoothly
- [ ] No console errors
- [ ] LocalStorage saves without delay

---

## Accessibility

- [ ] All buttons have proper labels
- [ ] Keyboard navigation works (Tab through all fields)
- [ ] Enter key works on dropdowns
- [ ] Escape closes modal
- [ ] Screen reader compatible (test role descriptions)

---

## Known Limitations

1. Custom roles limited by browser localStorage (typically ~5-10MB)
2. Role preset dropdown shows ALL roles (no search/filter yet)
3. Markup % field allows decimal (0.1% possible) - this is intentional
4. Cost field can equal sell field (0% markup) - this is intentional

---

## Troubleshooting

**If role presets don't appear:**
- Check browser console for errors
- Verify CREATIVE_INDUSTRY_ROLES constant loaded
- Check if dropdown is rendering

**If custom markup doesn't work:**
- Verify checkbox is checked
- Check if values are being saved to state
- Inspect element data in browser DevTools

**If duplication fails:**
- Check browser console
- Verify state.nextNestedMemberId incrementing
- Check if re-render is happening

**If old data won't migrate:**
- Check storage version in localStorage
- Verify migration logic running
- Check console for migration errors
