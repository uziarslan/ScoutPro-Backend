const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Coach = mongoose.model("Coach");

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      let user = await Coach.findById(decoded.id).select("-password");

      if (!user) {
        return res.status(401).json({ error: "User not found, unauthorized" });
      }

      req.user = user;

      next();
    } catch (error) {
      res.status(401).json({ message: "Not authorized, token failed" });
    }
  }

  if (!token) {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

module.exports = { protect };
