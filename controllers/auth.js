const mongoose = require("mongoose");
const Coach = mongoose.model("Coach");
const jwt = require("jsonwebtoken");

const jwt_secret = process.env.JWT_SECRET;

const generateToken = (id) => {
  return jwt.sign({ id }, jwt_secret, {
    expiresIn: "1d",
  });
};

const registerCoach = async (req, res) => {
  const { username, password } = req.body;
  const foundUser = await Coach.findOne({ username });

  if (foundUser) {
    return res
      .status(500)
      .json({ error: "Email already in use. Try differnt one." });
  }

  if (!username) {
    return res.status(500).json({ error: "Email is required." });
  }

  if (!password) {
    return res.status(500).json({ error: "Password is required." });
  }

  const coach = await Coach.create({
    ...req.body,
  });

  res.status(201).json({
    token: generateToken(coach._id),
    success: "Email has been registered",
  });
};

const handleLogin = async (req, res) => {
  const { username, password } = req.body;

  let user = await Coach.findOne({ username });

  if (!user) {
    return res.status(400).json({ error: "Invalid email or password" });
  }

  if (user && (await user.matchPassword(password))) {
    return res.json({
      token: generateToken(user._id),
    });
  } else {
    res.status(401).json({ error: "Invalid email or password" });
  }
};

const getUser = async (req, res) => {
  let user = await Coach.findById(req.user.id)
    .select("-password")
    .populate("players");

  if (!user) {
    user = await Organization.findById(req.user.id).select("-password");
  }

  if (!user) {
    return res.status(400).json({ error: "Invalid User" });
  }

  res.json(user);
};

module.exports = {
  registerCoach,
  handleLogin,
  getUser,
};
