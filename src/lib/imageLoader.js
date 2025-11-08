const imageLoader = ({ src, width, quality }) => {
  // If the image is from Supabase storage
  if (src.startsWith('https://jwnfltfrzkujvlzwkwff.supabase.co')) {
    // Add width and quality parameters for Supabase image optimization
    const url = new URL(src);
    url.searchParams.set('width', width.toString());
    url.searchParams.set('quality', (quality || 75).toString());
    url.searchParams.set('format', 'webp');
    return url.toString();
  }
  
  // For local images, let Next.js handle optimization
  return `${src}?w=${width}&q=${quality || 75}`;
};

export default imageLoader;
