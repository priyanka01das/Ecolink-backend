import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

import User from '../models/User.js';
import Listing from '../models/Listing.js';
import Request from '../models/Request.js';
import Notification from '../models/Notification.js';

const MOCK_DB_FILE = path.join(process.cwd(), 'data_store.json');
export let isMongoConnected = false;

// In-memory data store structure for fallback mode
export let mockData = {
  users: [],
  listings: [],
  requests: [],
  notifications: []
};

// Seed initial pre-authorized demo users if missing
const seedInitialData = () => {
  if (!mockData.users) mockData.users = [];
  const passwordHash = bcrypt.hashSync('password123', 10);
  
  if (!mockData.users.some(u => u.email.toLowerCase() === 'seller@ecolink.com')) {
    mockData.users.push({
      _id: 'user_seller_01',
      name: 'Green Earth Organics',
      email: 'seller@ecolink.com',
      password: passwordHash,
      role: 'food_business',
      photo: '',
      contact: { phone: '9876543210', altPhone: '', address: 'Bandra West, Mumbai' },
      location: { type: 'Point', coordinates: [72.8360, 19.0596] },
      createdAt: new Date().toISOString()
    });
  }

  if (!mockData.users.some(u => u.email.toLowerCase() === 'recycler@ecolink.com')) {
    mockData.users.push({
      _id: 'user_recycler_01',
      name: 'BioPower Energy Solutions',
      email: 'recycler@ecolink.com',
      password: passwordHash,
      role: 'biomass_company',
      photo: '',
      contact: { phone: '9876543211', altPhone: '', address: 'Andheri East, Mumbai' },
      location: { type: 'Point', coordinates: [72.8697, 19.1136] },
      createdAt: new Date().toISOString()
    });
  }

  if (!mockData.listings) mockData.listings = [];
  if (mockData.listings.length === 0) {
    mockData.listings.push(
      {
        _id: 'list_mock_101',
        producer: 'user_seller_01',
        category: 'raw_organic',
        weight: 250,
        description: 'High-energy organic vegetable peelings and fruit pulp',
        expiryHours: 18,
        pricingModel: 'priced',
        pricePerKg: 12,
        totalPrice: 3000,
        status: 'available',
        location: { type: 'Point', coordinates: [72.8800, 19.0800] },
        createdAt: new Date().toISOString()
      },
      {
        _id: 'list_mock_102',
        producer: 'user_seller_01',
        category: 'cooked_food',
        weight: 180,
        description: 'Bulk surplus catering food & rice waste',
        expiryHours: 8,
        pricingModel: 'priced',
        pricePerKg: 15,
        totalPrice: 2700,
        status: 'available',
        location: { type: 'Point', coordinates: [72.8650, 19.0700] },
        createdAt: new Date().toISOString()
      },
      {
        _id: 'list_mock_103',
        producer: 'user_seller_01',
        category: 'bakery',
        weight: 400,
        description: 'Spent brewery mash & stale bakery dough batches',
        expiryHours: 24,
        pricingModel: 'free',
        pricePerKg: 0,
        totalPrice: 0,
        status: 'available',
        location: { type: 'Point', coordinates: [72.8900, 19.0900] },
        createdAt: new Date().toISOString()
      }
    );
  }
};

// Helper: load mock data from JSON file if it exists
const loadMockData = () => {
  try {
    if (fs.existsSync(MOCK_DB_FILE)) {
      const fileContent = fs.readFileSync(MOCK_DB_FILE, 'utf-8');
      mockData = JSON.parse(fileContent);
    }
    seedInitialData();
    saveMockData();
  } catch (err) {
    console.error('Error loading mock data file, initializing fresh store:', err.message);
    seedInitialData();
  }
};

// Helper: save mock data to JSON file
export const saveMockData = () => {
  try {
    fs.writeFileSync(MOCK_DB_FILE, JSON.stringify(mockData, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save mock data to file:', err.message);
  }
};

// Haversine formula to calculate distance in km for mock geospatial queries
const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Connect to MongoDB with timeout, fallback to JSON/memory store if unavailable
export const initDatabase = async () => {
  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/ecolink';
  
  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 2000 // 2 seconds timeout for quick fallback
    });
    isMongoConnected = true;
    console.log(`✅ Connected to MongoDB successfully (${mongoURI})`);
    return 'mongodb';
  } catch (err) {
    isMongoConnected = false;
    console.log(`⚠️ Local MongoDB daemon unavailable (${err.message}).`);
    console.log(`📈 Running in file-backed local database fallback mode.`);
    loadMockData();
    return 'mock';
  }
};

// --- UNIFIED DATABASE OPERATIONS INTERFACE ---
export const dbService = {
  users: {
    create: async (data) => {
      if (isMongoConnected) {
        const user = await User.create(data);
        return user.toObject();
      } else {
        const id = 'user_' + Math.random().toString(36).substring(2, 9);
        const newUser = { _id: id, createdAt: new Date().toISOString(), ...data };
        mockData.users.push(newUser);
        saveMockData();
        return newUser;
      }
    },
    findByEmail: async (email) => {
      const cleanEmail = email.toLowerCase().trim();
      if (isMongoConnected) {
        const user = await User.findOne({ email: cleanEmail }).select('+password');
        return user ? user.toObject() : null;
      } else {
        return mockData.users.find(u => u.email.toLowerCase() === cleanEmail) || null;
      }
    },
    findById: async (id) => {
      if (isMongoConnected) {
        const user = await User.findById(id);
        return user ? user.toObject() : null;
      } else {
        return mockData.users.find(u => u._id.toString() === id.toString()) || null;
      }
    },
    update: async (id, updates) => {
      if (isMongoConnected) {
        const user = await User.findByIdAndUpdate(id, updates, { new: true });
        return user ? user.toObject() : null;
      } else {
        const idx = mockData.users.findIndex(u => u._id.toString() === id.toString());
        if (idx !== -1) {
          mockData.users[idx] = { ...mockData.users[idx], ...updates };
          saveMockData();
          return mockData.users[idx];
        }
        return null;
      }
    }
  },

  listings: {
    create: async (data) => {
      if (isMongoConnected) {
        const listing = await Listing.create(data);
        const populated = await Listing.findById(listing._id).populate('producer', 'name email contact photo location');
        return populated.toObject();
      } else {
        const id = 'list_' + Math.random().toString(36).substring(2, 9);
        const newListing = { _id: id, createdAt: new Date().toISOString(), ...data };
        mockData.listings.push(newListing);
        saveMockData();

        const producerObj = mockData.users.find(u => u._id.toString() === data.producer.toString());
        return {
          ...newListing,
          producer: producerObj ? { _id: producerObj._id, name: producerObj.name, email: producerObj.email, contact: producerObj.contact, photo: producerObj.photo, location: producerObj.location } : null
        };
      }
    },
    findAll: async (filters = {}) => {
      if (isMongoConnected) {
        let query = { status: 'available' };
        if (filters.lat && filters.lng && filters.radius) {
          const lat = parseFloat(filters.lat);
          const lng = parseFloat(filters.lng);
          const radiusMeters = parseFloat(filters.radius) * 1000;
          query.location = {
            $near: {
              $geometry: { type: 'Point', coordinates: [lng, lat] },
              $maxDistance: radiusMeters
            }
          };
        }
        
        const listings = await Listing.find(query).populate('producer', 'name email contact photo location').sort({ createdAt: -1 });
        return listings.map(l => l.toObject());
      } else {
        let results = [...mockData.listings];
        results = results.filter(l => l.status === 'available');

        if (filters.lat && filters.lng && filters.radius) {
          const lat1 = parseFloat(filters.lat);
          const lon1 = parseFloat(filters.lng);
          const radiusKm = parseFloat(filters.radius);
          results = results.filter(l => {
            if (!l.location || !l.location.coordinates) return false;
            const [lon2, lat2] = l.location.coordinates;
            const dist = getDistanceKm(lat1, lon1, lat2, lon2);
            return dist <= radiusKm;
          });
        }
        
        return results.map(l => {
          const producer = mockData.users.find(u => u._id.toString() === (l.producer._id || l.producer).toString());
          return {
            ...l,
            producer: producer ? { _id: producer._id, name: producer.name, email: producer.email, contact: producer.contact, photo: producer.photo, location: producer.location } : null
          };
        });
      }
    },
    findByProducer: async (producerId) => {
      if (isMongoConnected) {
        const listings = await Listing.find({ producer: producerId }).populate('producer', 'name email contact photo location').sort({ createdAt: -1 });
        return listings.map(l => l.toObject());
      } else {
        return mockData.listings
          .filter(l => (l.producer._id || l.producer).toString() === producerId.toString())
          .map(l => {
            const producer = mockData.users.find(u => u._id.toString() === producerId.toString());
            return {
              ...l,
              producer: producer ? { _id: producer._id, name: producer.name, email: producer.email, contact: producer.contact, photo: producer.photo, location: producer.location } : null
            };
          });
      }
    },
    findById: async (id) => {
      if (isMongoConnected) {
        const listing = await Listing.findById(id).populate('producer', 'name email contact photo location');
        return listing ? listing.toObject() : null;
      } else {
        const l = mockData.listings.find(item => item._id.toString() === id.toString());
        if (!l) return null;
        const producer = mockData.users.find(u => u._id.toString() === (l.producer._id || l.producer).toString());
        return {
          ...l,
          producer: producer ? { _id: producer._id, name: producer.name, email: producer.email, contact: producer.contact, photo: producer.photo, location: producer.location } : null
        };
      }
    },
    update: async (id, updates) => {
      if (isMongoConnected) {
        const listing = await Listing.findByIdAndUpdate(id, updates, { new: true }).populate('producer', 'name email contact photo location');
        return listing ? listing.toObject() : null;
      } else {
        const idx = mockData.listings.findIndex(l => l._id.toString() === id.toString());
        if (idx !== -1) {
          mockData.listings[idx] = { ...mockData.listings[idx], ...updates };
          saveMockData();
          const l = mockData.listings[idx];
          const producer = mockData.users.find(u => u._id.toString() === (l.producer._id || l.producer).toString());
          return {
            ...l,
            producer: producer ? { _id: producer._id, name: producer.name, email: producer.email, contact: producer.contact, photo: producer.photo, location: producer.location } : null
          };
        }
        return null;
      }
    },
    delete: async (id) => {
      if (isMongoConnected) {
        const listing = await Listing.findByIdAndDelete(id);
        await Request.deleteMany({ listing: id });
        return listing ? listing.toObject() : null;
      } else {
        const idx = mockData.listings.findIndex(l => l._id.toString() === id.toString());
        if (idx !== -1) {
          const deleted = mockData.listings.splice(idx, 1)[0];
          mockData.requests = mockData.requests.filter(r => (r.listing._id || r.listing).toString() !== id.toString());
          saveMockData();
          return deleted;
        }
        return null;
      }
    }
  },

  requests: {
    create: async (data) => {
      if (isMongoConnected) {
        const req = await Request.create(data);
        const populated = await Request.findById(req._id)
          .populate('listing')
          .populate('consumer', 'name email contact photo')
          .populate('producer', 'name email contact photo');
        return populated.toObject();
      } else {
        const id = 'req_' + Math.random().toString(36).substring(2, 9);
        const newReq = { _id: id, createdAt: new Date().toISOString(), ...data };
        mockData.requests.push(newReq);
        saveMockData();

        const listing = mockData.listings.find(l => l._id.toString() === data.listing.toString());
        const consumer = mockData.users.find(u => u._id.toString() === data.consumer.toString());
        const producer = mockData.users.find(u => u._id.toString() === data.producer.toString());

        return {
          ...newReq,
          listing,
          consumer: consumer ? { _id: consumer._id, name: consumer.name, email: consumer.email, contact: consumer.contact, photo: consumer.photo } : null,
          producer: producer ? { _id: producer._id, name: producer.name, email: producer.email, contact: producer.contact, photo: producer.photo } : null
        };
      }
    },
    findById: async (id) => {
      if (isMongoConnected) {
        const req = await Request.findById(id)
          .populate('listing')
          .populate('consumer', 'name email contact photo')
          .populate('producer', 'name email contact photo');
        return req ? req.toObject() : null;
      } else {
        const r = mockData.requests.find(item => item._id.toString() === id.toString());
        if (!r) return null;
        const listing = mockData.listings.find(l => l._id.toString() === (r.listing._id || r.listing).toString());
        const consumer = mockData.users.find(u => u._id.toString() === (r.consumer._id || r.consumer).toString());
        const producer = mockData.users.find(u => u._id.toString() === (r.producer._id || r.producer).toString());
        return {
          ...r,
          listing,
          consumer: consumer ? { _id: consumer._id, name: consumer.name, email: consumer.email, contact: consumer.contact, photo: consumer.photo } : null,
          producer: producer ? { _id: producer._id, name: producer.name, email: producer.email, contact: producer.contact, photo: producer.photo } : null
        };
      }
    },
    findForUser: async (userId, role) => {
      if (isMongoConnected) {
        const query = role === 'food_business' ? { producer: userId } : { consumer: userId };
        const reqs = await Request.find(query)
          .populate({
            path: 'listing',
            populate: { path: 'producer', select: 'name email contact photo' }
          })
          .populate('consumer', 'name email contact photo')
          .populate('producer', 'name email contact photo')
          .sort({ createdAt: -1 });
        return reqs.map(r => r.toObject());
      } else {
        const key = role === 'food_business' ? 'producer' : 'consumer';
        return mockData.requests
          .filter(r => (r[key]._id || r[key]).toString() === userId.toString())
          .map(r => {
            const listing = mockData.listings.find(l => l._id.toString() === (r.listing._id || r.listing).toString());
            const consumer = mockData.users.find(u => u._id.toString() === (r.consumer._id || r.consumer).toString());
            const producer = mockData.users.find(u => u._id.toString() === (r.producer._id || r.producer).toString());
            return {
              ...r,
              listing,
              consumer: consumer ? { _id: consumer._id, name: consumer.name, email: consumer.email, contact: consumer.contact, photo: consumer.photo } : null,
              producer: producer ? { _id: producer._id, name: producer.name, email: producer.email, contact: producer.contact, photo: producer.photo } : null
            };
          });
      }
    },
    update: async (id, updates) => {
      if (isMongoConnected) {
        const req = await Request.findByIdAndUpdate(id, updates, { new: true })
          .populate('listing')
          .populate('consumer', 'name email contact photo')
          .populate('producer', 'name email contact photo');
        return req ? req.toObject() : null;
      } else {
        const idx = mockData.requests.findIndex(r => r._id.toString() === id.toString());
        if (idx !== -1) {
          mockData.requests[idx] = { ...mockData.requests[idx], ...updates };
          saveMockData();
          const r = mockData.requests[idx];
          const listing = mockData.listings.find(l => l._id.toString() === (r.listing._id || r.listing).toString());
          const consumer = mockData.users.find(u => u._id.toString() === (r.consumer._id || r.consumer).toString());
          const producer = mockData.users.find(u => u._id.toString() === (r.producer._id || r.producer).toString());
          return {
            ...r,
            listing,
            consumer: consumer ? { _id: consumer._id, name: consumer.name, email: consumer.email, contact: consumer.contact, photo: consumer.photo } : null,
            producer: producer ? { _id: producer._id, name: producer.name, email: producer.email, contact: producer.contact, photo: producer.photo } : null
          };
        }
        return null;
      }
    },
    delete: async (id) => {
      if (isMongoConnected) {
        const req = await Request.findByIdAndDelete(id);
        return req ? req.toObject() : null;
      } else {
        const idx = mockData.requests.findIndex(r => r._id.toString() === id.toString());
        if (idx !== -1) {
          const deleted = mockData.requests.splice(idx, 1)[0];
          saveMockData();
          return deleted;
        }
        return null;
      }
    }
  },

  notifications: {
    create: async (data) => {
      if (isMongoConnected) {
        const notif = await Notification.create(data);
        return notif.toObject();
      } else {
        const id = 'notif_' + Math.random().toString(36).substring(2, 9);
        const newNotif = { _id: id, createdAt: new Date().toISOString(), read: false, ...data };
        mockData.notifications.push(newNotif);
        saveMockData();
        return newNotif;
      }
    },
    findForUser: async (userId) => {
      if (isMongoConnected) {
        const notifs = await Notification.find({ recipient: userId }).sort({ createdAt: -1 });
        return notifs.map(n => n.toObject());
      } else {
        return mockData.notifications
          .filter(n => (n.recipient._id || n.recipient).toString() === userId.toString())
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    },
    markRead: async (id) => {
      if (isMongoConnected) {
        await Notification.findByIdAndUpdate(id, { read: true });
        return true;
      } else {
        const idx = mockData.notifications.findIndex(n => n._id.toString() === id.toString());
        if (idx !== -1) {
          mockData.notifications[idx].read = true;
          saveMockData();
          return true;
        }
        return false;
      }
    }
  }
};
