const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },
  googleId: {
    type: String,
  },
  googleOAuth: {
    accessToken: {
      type: String,
    },
    refreshToken: {
      type: String,
    },
    scope: {
      type: String,
    },
    tokenType: {
      type: String,
    },
    expiryDate: {
      type: Date,
    },
    connectedAt: {
      type: Date,
    },
  },
  avatar: {
    type: String,
    default: 'https://res.cloudinary.com/demo/image/upload/v1574943962/profile_placeholder_s5a0y5.png', // Default placeholder
  },
  otp: {
    type: String,
  },
  otpExpires: {
    type: Date,
  },
}, { timestamps: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  // Only hash password if it exists (Google auth users might not have password)
  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

export {};
