# Organisation Page Slider Design

## Overview
The slider component in the Organisation page matches the design from `Spec/Phase15/strategy-pantheon-preview-v2.html` while maintaining full theme color integration.

## Design Specifications

### Visual Design
- **Shape**: Full pill shape with `border-radius: 999px`
- **Container**: Light tinted background with no border
- **Buttons**: Transparent by default, solid brand color when active
- **Shadow**: Prominent shadow on active state for depth

### Dimensions
| Property | Value | Purpose |
|----------|-------|---------|
| Container padding | `4px` | Tight spacing around buttons |
| Button gap | `4px` | Consistent spacing between buttons |
| Button padding | `6px 14px` | Balanced horizontal/vertical spacing |
| Button min-width | `100px` | Ensures consistent button sizing |
| Button font-size | `13px` | Slightly smaller for cleaner look |

## Color Mapping

### Spec HTML → Theme Variables

| Spec Color | Purpose | Theme Variable | Adapts To |
|------------|---------|----------------|-----------|
| `#f0edff` | Container background | `var(--brand-100)` | Each theme's light tint |
| `#504a7c` | Inactive text | `var(--text-secondary)` | Each theme's muted text |
| `#6c5ce7` | Active background | `var(--brand-primary)` | Each theme's primary color |
| `white` | Active text | `white` | Universal white |
| `rgba(108, 92, 231, 0.25)` | Active shadow | `var(--shadow-brand)` | Each theme's shadow |

### Theme Examples

#### Purple Theme
- Container: `#f1f5f9` (light purple-gray)
- Active: `#6366f1` (vibrant purple)
- Shadow: Purple-tinted shadow

#### Coffee Theme
- Container: `#f2e8dc` (light coffee)
- Active: `#6f4e37` (coffee brown)
- Shadow: Brown-tinted shadow

#### Corporate/Nature/Microsoft Themes
- Each uses their respective `--brand-100` and `--brand-primary` colors
- Automatic adaptation without code changes

## Implementation Details

### CSS Classes
- `.toggleSwitch` - Container with pill shape and light background
- `.toggleOption` - Individual button with transparent default state
- `.toggleOption:hover` - Subtle hover effect
- `.toggleOption.active` - Solid brand color with prominent shadow

### Key Features
1. **Automatic theme adaptation**: All colors use CSS variables
2. **Accessible**: Maintains good contrast ratios
3. **Responsive**: Works on all screen sizes
4. **Smooth transitions**: 0.2s ease for all state changes

## Comparison with Spec

| Aspect | Spec Design | Implementation | Match |
|--------|-------------|----------------|-------|
| Shape | Pill (999px) | Pill (999px) | ✅ |
| Container bg | Light purple | `var(--brand-100)` | ✅ |
| Border | None | None | ✅ |
| Padding | 4px | 4px | ✅ |
| Button padding | 6px 14px | 6px 14px | ✅ |
| Active color | Solid purple | `var(--brand-primary)` | ✅ |
| Shadow | Prominent | `var(--shadow-brand)` | ✅ |
| Theme support | Fixed colors | Dynamic variables | ✅ Better |

## Benefits

1. **Theme Integration**: Automatically adapts to all existing and future themes
2. **Maintainability**: Single source of truth for colors in theme files
3. **Consistency**: Matches spec design while following project patterns
4. **Flexibility**: Easy to adjust by modifying theme variables
5. **Performance**: No JavaScript needed for theme switching

## Future Enhancements

If needed, the design can be further enhanced by:
- Adding keyboard navigation indicators
- Supporting more than 3 options
- Adding icons to buttons
- Implementing disabled states