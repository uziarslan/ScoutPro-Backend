const Agenda = require("agenda");
// const puppeteer = require("puppeteer");
const { uploader } = require("cloudinary").v2;
const wrapAsync = require("../utils/wrapAsync");
const mongoose = require("mongoose");
const Player = mongoose.model("Player");
const fs = require("fs").promises;
const chromium = require("chrome-aws-lambda");

async function htmlToImage(player, width = 760, height = 950) {
  // Launch browser using chrome-aws-lambda
  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
  });

  const page = await browser.newPage();
  await page.setViewport({ width, height });

  let htmlContent = await fs.readFile("templates/pdf.html", "utf8");

  // Replace placeholders in HTML template with player data
  htmlContent = htmlContent
    .replace("{{playerName}}", player.playerName)
    .replace("{{weight}}", player.weight || "N/A")
    .replace("{{heightWithShoes}}", player.heightWithShoes || "N/A")
    .replace("{{bodyFat}}", player.bodyFat || "N/A")
    .replace("{{wingSpan}}", player.wingSpan || "N/A")
    .replace("{{standingReach}}", player.standingReach || "N/A")
    .replace("{{handWidth}}", player.handWidth || "N/A")
    .replace("{{handLength}}", player.handLength || "N/A")
    .replace("{{standingVert}}", player.standingVert || "N/A")
    .replace("{{maxVert}}", player.maxVert || "N/A")
    .replace("{{laneAgility}}", player.laneAgility || "N/A")
    .replace("{{shuttle}}", player.shuttle || "N/A")
    .replace("{{courtSprint}}", player.courtSprint || "N/A")
    .replace("{{maxSpeed}}", player.maxSpeed || "N/A")
    .replace("{{maxJump}}", player.maxJump || "N/A")
    .replace("{{prpp}}", player.prpp || "N/A")
    .replace("{{acceleration}}", player.acceleration || "N/A")
    .replace("{{deceleration}}", player.deceleration || "N/A")
    .replace("{{ttto}}", player.ttto || "N/A")
    .replace("{{breakingPhase}}", player.brakingPhase || "N/A")
    .replace(
      "{{description}}",
      player.description === "N/A"
        ? "No description available."
        : player.description
    )
    .replace(
      "{{mugShot}}",
      player.images[0]?.path ||
        "https://res.cloudinary.com/uzairarslan/image/upload/v1730518031/ScoutPro/Players/ehqjrudw4jw61lzju8pt.png"
    )
    .replace(
      "{{standingShot}}",
      player.images[1]?.path ||
        "https://res.cloudinary.com/uzairarslan/image/upload/v1731158399/ScoutPro/Group_48_c0akgu.png"
    );

  await page.setContent(htmlContent, { waitUntil: "networkidle0" });
  const screenshotBuffer = await page.screenshot();
  await browser.close();

  // If an existing preview image exists, delete it from Cloudinary
  if (player.pdfPreview && player.pdfPreview.filename) {
    const publicId = player.pdfPreview.filename.split("/").pop().split(".")[0];
    await new Promise((resolve, reject) => {
      uploader.destroy(
        publicId,
        { resource_type: "image" },
        (error, result) => {
          if (error) {
            console.error("Failed to delete old image from Cloudinary:", error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
    });
  }

  // Upload the new image to Cloudinary
  const result = await new Promise((resolve, reject) => {
    uploader
      .upload_stream({ resource_type: "image" }, (error, result) => {
        if (error) {
          reject(new Error("Failed to upload image to Cloudinary"));
        } else {
          resolve(result);
        }
      })
      .end(screenshotBuffer);
  });

  return { filename: result.public_id, path: result.secure_url };
}

const agenda = new Agenda({ db: { address: process.env.MONGODB_URI } });

agenda.define(
  "generate player image",
  wrapAsync(async (job) => {
    const { player } = job.attrs.data;

    const pdf = await htmlToImage(player);

    await Player.findByIdAndUpdate(player._id, { pdfPreview: pdf });
  })
);

module.exports = agenda;
