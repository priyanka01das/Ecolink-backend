import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema(
  {
    producer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Producer is required']
    },
    category: {
      type: String,
      required: [true, 'Category is required']
    },
    weight: {
      type: Number,
      required: [true, 'Weight in kg is required'],
      min: [0.1, 'Weight must be greater than 0']
    },
    description: {
      type: String,
      default: ''
    },
    expiryHours: {
      type: Number,
      default: 24
    },
    status: {
      type: String,
      enum: ['available', 'requested', 'scheduled', 'collected'],
      default: 'available'
    },
    pricingModel: {
      type: String,
      enum: ['free', 'priced'],
      default: 'free'
    },
    pricePerKg: {
      type: Number,
      default: 0
    },
    totalPrice: {
      type: Number,
      default: 0
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// 2dsphere geospatial index for spatial queries
listingSchema.index({ location: '2dsphere' });

const Listing = mongoose.models.Listing || mongoose.model('Listing', listingSchema);
export default Listing;
