// Simple hash function for consistent color generation
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Generate SVG avatar similar to boring-avatars
export function generateAvatarSVG(name, size = 68) {
  const hash = hashCode(name);
  const colors = ['#92A1C6', '#146A7C', '#F0AB3D', '#C271B4', '#C20D90'];
  
  // Use hash to select colors and generate pattern
  const color1 = colors[hash % colors.length];
  const color2 = colors[(hash + 1) % colors.length];
  const color3 = colors[(hash + 2) % colors.length];
  
  // Generate simple geometric pattern
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${color1}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${size/3}" fill="${color2}"/>
      <rect x="${size/4}" y="${size/4}" width="${size/2}" height="${size/2}" fill="${color3}" opacity="0.7"/>
    </svg>
  `;
  
  return svg.trim();
}