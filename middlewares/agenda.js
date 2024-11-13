const Agenda = require("agenda");
const puppeteer = require("puppeteer");
const { uploader } = require("cloudinary").v2;
const wrapAsync = require("../utils/wrapAsync");
const mongoose = require("mongoose");
const Player = mongoose.model("Player");
const generateTemplate = require("./template");

async function htmlToImage(player, width = 760, height = 950) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setViewport({ width, height });

  let htmlContent = await generateTemplate(player);

  await page.setContent(htmlContent, { waitUntil: "networkidle0" });
  const screenshotBuffer = await page.screenshot();
  await browser.close();

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

agenda.define(
  "deleteFileFromCloudinary",
  wrapAsync(async (job) => {
    const { publicId } = job.attrs.data;

    await new Promise((resolve, reject) => {
      uploader.destroy(
        publicId,
        { resource_type: "image" },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
    });
  })
);

module.exports = agenda;
