// Theme Manager - Handles dynamic theme loading and switching

export const themes = [
  {
    id: 'purple',
    name: 'Purple',
    description: 'Modern purple theme',
    preview: '#6366f1',
    file: '/styles/themes/purple.css',
    isDark: false
  },
  {
    id: 'dreambig',
    name: 'DreamBig',
    description: 'DreamBig palette with Staycation/Sunset/Horizon tones',
    preview: '#65009b',
    file: '/styles/themes/dreambig.css',
    isDark: false
  },
  {
    id: 'coffee',
    name: 'Coffee',
    description: 'Warm coffee brown theme',
    preview: '#6f4e37',
    file: '/styles/themes/coffee.css',
    isDark: false
  },
  {
    id: 'microsoft',
    name: 'Blue',
    description: 'Professional blue theme',
    preview: '#0078d4',
    file: '/styles/themes/microsoft.css',
    isDark: false
  },
  {
    id: 'nature',
    name: 'Green',
    description: 'Fresh nature green theme',
    preview: '#2d5016',
    file: '/styles/themes/nature.css',
    isDark: false
  }
];

// Track loaded theme files to avoid duplicates
const loadedThemeFiles = new Set();

export const loadTheme = async (themeId) => {
  const theme = themes.find(t => t.id === themeId);
  if (!theme) {
    console.warn(`Theme ${themeId} not found`);
    return false;
  }

  try {
    // For Next.js, we'll rely on the CSS being imported in layout.js
    // Just apply the theme attribute and save to localStorage
    document.documentElement.setAttribute('data-theme', themeId);
    localStorage.setItem('theme', themeId);
    
    console.log(`Theme applied: ${themeId}`);
    return true;
  } catch (error) {
    console.error(`Failed to apply theme ${themeId}:`, error);
    return false;
  }
};

export const getCurrentTheme = () => {
  if (typeof window === 'undefined') return 'coffee'; // Default for SSR
  
  const savedTheme = localStorage.getItem('theme');
  const currentTheme = document.documentElement.getAttribute('data-theme');
  
  return savedTheme || currentTheme || 'coffee';
};

export const initializeTheme = async () => {
  if (typeof window === 'undefined') return;
  
  // Base theme is now imported in layout.js, so we just need to apply the current theme
  const currentTheme = getCurrentTheme();
  await loadTheme(currentTheme);
};

export const getThemeById = (themeId) => {
  return themes.find(t => t.id === themeId);
};

export const getThemesByFamily = () => {
  const families = {};
  themes.forEach(theme => {
    const family = theme.id.split('-')[0]; // e.g., 'coffee' from 'coffee-dark'
    if (!families[family]) {
      families[family] = [];
    }
    families[family].push(theme);
  });
  return families;
};
