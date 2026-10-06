import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false
    },
    role: {
      type: String,
      enum: ['food_business', 'biomass_company'],
      required: [true, 'Role is required']
    },
    photo: {
      type: String,
      default: ''
    },
    contact: {
      phone: { type: String, default: '' },
      altPhone: { type: String, default: '' },
      address: { type: String, default: '' }
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [72.8777, 19.0760] // Mumbai default coordinates
      }
    },
    resetPasswordCode: {
      type: String,
      default: null
    },
    resetPasswordExpires: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

// 2dsphere geospatial index for location queries
userSchema.index({ location: '2dsphere' });

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;
