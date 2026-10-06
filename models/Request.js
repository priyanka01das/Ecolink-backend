import mongoose from 'mongoose';

const requestSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: [true, 'Listing is required']
    },
    consumer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Consumer (Bio-Energy Recycler) is required']
    },
    producer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Producer (Waste Seller) is required']
    },
    scheduledTime: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'completed'],
      default: 'pending'
    },
    notes: {
      type: String,
      default: ''
    },
    paymentStatus: {
      type: String,
      enum: ['free', 'paid', 'pending_pod', 'escrow'],
      default: 'free'
    },
    paymentMethod: {
      type: String,
      enum: ['free', 'upi', 'netbanking', 'card', 'pod', 'escrow'],
      default: 'free'
    },
    unitPrice: {
      type: Number,
      default: 0
    },
    subtotal: {
      type: Number,
      default: 0
    },
    logisticsFee: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      default: 0
    },
    invoiceNumber: {
      type: String,
      default: ''
    },
    transactionId: {
      type: String,
      default: ''
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

const Request = mongoose.models.Request || mongoose.model('Request', requestSchema);
export default Request;
