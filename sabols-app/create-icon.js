const sharp = require('sharp');
const fs = require('fs');

async function createHighQualityIcon() {
  const inputPath = 'D:\\Fool\\mobile-app\\public\\Sobals logo.jpg';
  const outputPath = 'D:\\Fool\\water-mobile-application\\assets\\icon.png';
  
  // Create a 1024x1024 white background
  const background = sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  });

  // Resize the logo so it fits perfectly inside the adaptive icon safe zone (roughly 60-66% of the 1024 grid)
  const logoBuffer = await sharp(inputPath)
    .resize(650, 650, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .toBuffer();

  // Overlay the logo perfectly in the center
  await background
    .composite([{ input: logoBuffer, gravity: 'center' }])
    .png({ quality: 100 })
    .toFile(outputPath);

  console.log('High quality icon.png created at 1024x1024!');
}

createHighQualityIcon().catch(console.error);
