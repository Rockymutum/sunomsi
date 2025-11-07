const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

// Create a simple splash screen image
function createSplashScreen() {
  // iPhone 15 Pro dimensions (1242 x 2688)
  const width = 1242;
  const height = 2688;
  
  // Create canvas
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Fill with your brand color (#1F2937 - gray-800)
  ctx.fillStyle = '#1F2937';
  ctx.fillRect(0, 0, width, height);
  
  // Add logo or text in the center
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // Add app name
  ctx.font = 'bold 72px Arial';
  ctx.fillText('SUNOMSI', width / 2, height / 2);
  
  // Save to public folder
  const publicPath = path.join(process.cwd(), 'public');
  const outputPath = path.join(publicPath, 'splash.png');
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  
  console.log(`Splash screen generated at: ${outputPath}`);
}

createSplashScreen();
