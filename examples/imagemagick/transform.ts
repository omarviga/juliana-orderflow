// ImageMagick WASM example using @imagemagick/magick-wasm (pseudo)
// npm i @imagemagick/magick-wasm

import { Magick } from '@imagemagick/magick-wasm';

export async function transformImage(inputBuffer) {
  await Magick.ready;
  const image = await Magick.read(inputBuffer);
  image.resize(800, 0);
  const out = await image.write('png');
  return out;
}
