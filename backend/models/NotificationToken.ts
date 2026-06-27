const mongoose = require('mongoose');

const notificationTokenSchema = mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
    },
    deviceType: {
      type: String,
      default: 'unknown',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    }
  },
  {
    timestamps: true,
  }
);

notificationTokenSchema.index({ isActive: 1, updatedAt: -1 });

module.exports = mongoose.model('NotificationToken', notificationTokenSchema);

export {};
