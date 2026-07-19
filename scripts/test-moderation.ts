import dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { moderateText, moderateImage } from "../src/lib/moderation";

async function main() {
  console.log("=== Test moderazione NSFW ===\n");

  // Test 1: testo NSFW
  console.log("Test 1: testo NSFW");
  const nsfwText = "explicit pornographic content xxx";
  const textResult = await moderateText(nsfwText);
  console.log("Input:", nsfwText);
  console.log("Risultato:", textResult);
  console.log("");

  // Test 2: testo normale
  console.log("Test 2: testo normale");
  const normalText = "Ciao, questo è un bellissimo paesaggio montano!";
  const normalResult = await moderateText(normalText);
  console.log("Input:", normalText);
  console.log("Risultato:", normalResult);
  console.log("");

  // Test 3: immagine sicura (1x1 pixel rosso)
  console.log("Test 3: immagine sicura (1x1 pixel)");
  const safeImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  const imageResult = await moderateImage(safeImage);
  console.log("Input: immagine 1x1 pixel rosso");
  console.log("Risultato:", imageResult);
  console.log("");

  // Test 4: nome file sospetto
  console.log("Test 4: nome file sospetto");
  const { moderateFile } = await import("../src/lib/moderation");
  const fileResult = await moderateFile("porn_xxx_video.mp4", "video/mp4");
  console.log("Input: porn_xxx_video.mp4");
  console.log("Risultato:", fileResult);
  console.log("");

  console.log("=== Fine test ===");
}

main().catch(console.error);
