const fs = require('fs');

// Simple 1x1 pixel PNG in base64 (transparent)
const png1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

// Create a simple 192x192 PNG with a blue background and white "FS" text
const createSimplePNG = (size, text) => {
  // This is a minimal PNG with a solid color background
  // In a real app, you'd want proper logo files
  const canvas = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#4F46E5"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size/4}" font-weight="bold" text-anchor="middle" dominant-baseline="middle" fill="white">${text}</text>
</svg>`;
  return canvas;
};

// Create SVG files first
fs.writeFileSync('logo192.svg', createSimplePNG(192, 'FS'));
fs.writeFileSync('logo512.svg', createSimplePNG(512, 'FS'));

console.log('Created SVG logo files. You can convert them to PNG using an online converter or image editor.');
console.log('For now, the app will work without the PNG files, just with a warning.');
