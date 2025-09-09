import { FastAverageColor } from 'fast-average-color';

const fac = new FastAverageColor();

export const extractDominantColor = async (imageUrl: string): Promise<string> => {
  try {
    const color = await fac.getColorAsync(imageUrl, { 
      algorithm: 'dominant',
      ignoredColor: [255, 255, 255, 255] // ignore white background
    });
    
    // Return a slightly muted version of the color for better background usage
    const rgbArray = color.value;
    const [r, g, b] = rgbArray;
    const mutedR = Math.round(r * 0.85 + 255 * 0.15);
    const mutedG = Math.round(g * 0.85 + 255 * 0.15);
    const mutedB = Math.round(b * 0.85 + 255 * 0.15);
    
    return `rgb(${mutedR}, ${mutedG}, ${mutedB})`;
  } catch (error) {
    console.error('Error extracting color:', error);
    // Fallback to a nice gradient
    return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  }
};

export const getAvatarUrl = (person: any): string => {
  if (person.avatar_url) return person.avatar_url;
  if (person.discord_avatar_url) return person.discord_avatar_url;
  if (person.discord_id && person.discord_avatar) {
    return `https://cdn.discordapp.com/avatars/${person.discord_id}/${person.discord_avatar}.png?size=256`;
  }
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(person.name)}`;
};

export const getContrastingTextColor = (backgroundColor: string): string => {
  // Simple function to determine if we should use light or dark text
  // This is a basic implementation - for a more sophisticated approach, 
  // you'd want to calculate the actual luminance
  if (backgroundColor.includes('rgb')) {
    const rgbValues = backgroundColor.match(/\d+/g);
    if (rgbValues && rgbValues.length >= 3) {
      const [r, g, b] = rgbValues.map(Number);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5 ? '#000000' : '#ffffff';
    }
  }
  return '#ffffff'; // Default to white text
};
