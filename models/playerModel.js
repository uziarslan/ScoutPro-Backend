const mongoose = require("mongoose");

const playerSchema = new mongoose.Schema({
  images: [
    {
      filename: String,
      path: String,
      fileType: String,
    },
  ],
  videos: [String],
  playerName: String,
  position: String,
  heightWithShoes: String,
  weight: String,
  bodyFat: String,
  wingSpan: String,
  standingReach: String,
  handWidth: String,
  handLength: String,
  standingVert: String,
  maxVert: String,
  laneAgility: String,
  shuttle: String,
  courtSprint: String,
  description: String,
  teamName: String,
  maxSpeed: String,
  maxJump: String,
  prpp: String,
  acceleration: String,
  deceleration: String,
  ttto: String,
  brakingPhase: String,
  pdfPreview: {
    filename: String,
    path: String,
  },
});

module.exports = mongoose.model("Player", playerSchema);
