import { dbService, isMongoConnected, mockData } from '../services/dbService.js';
import User from '../models/User.js';
import { emitNotificationToUser } from '../config/socket.js';

// @desc    Create a new waste batch listing
// @route   POST /api/listings
// @access  Private (food_business)
export const createListing = async (req, res) => {
  try {
    if (req.user.role !== 'food_business') {
      return res.status(403).json({ message: 'Only registered Food Businesses can log waste batches' });
    }

    const { category, weight, description, expiryHours, pricingModel, pricePerKg } = req.body || {};

    if (!category || !weight) {
      return res.status(400).json({ message: 'Category and weight in kg are required' });
    }

    const numWeight = parseFloat(weight);
    const model = pricingModel === 'priced' ? 'priced' : 'free';
    const rate = model === 'priced' ? parseFloat(pricePerKg || 12) : 0;
    const computedTotal = model === 'priced' ? Math.round(numWeight * rate) : 0;

    // Inherit producer's coordinates from req.user
    const location = req.user.location && req.user.location.coordinates
      ? req.user.location
      : { type: 'Point', coordinates: [72.8777, 19.0760] };

    const listing = await dbService.listings.create({
      producer: req.user._id,
      category,
      weight: numWeight,
      description: description || '',
      expiryHours: expiryHours ? parseFloat(expiryHours) : 24,
      pricingModel: model,
      pricePerKg: rate,
      totalPrice: computedTotal,
      status: 'available',
      location
    });

    // Notify biomass companies via database notifications & real-time Socket.IO events
    try {
      let recyclers = [];
      if (isMongoConnected) {
        recyclers = await User.find({ role: 'biomass_company' });
      } else {
        recyclers = mockData.users.filter(u => u.role === 'biomass_company');
      }

      for (const recycler of recyclers) {
        const notif = await dbService.notifications.create({
          recipient: recycler._id,
          title: '🌱 New Resource Available!',
          message: `${req.user.name} logged ${weight} kg of ${category.replace('_', ' ')}.`,
          type: 'system'
        });
        emitNotificationToUser(recycler._id, notif);
      }
    } catch (notifErr) {
      console.error('Error sending new listing notifications:', notifErr.message);
    }

    res.status(201).json(listing);
  } catch (error) {
    console.error('Create listing error:', error);
    res.status(500).json({ message: 'Failed to create waste listing' });
  }
};

// @desc    Get waste listings with optional geospatial filtering
// @route   GET /api/listings
// @access  Private
export const getListings = async (req, res) => {
  try {
    const { lat, lng, radius } = req.query;

    const listings = await dbService.listings.findAll({
      status: 'available',
      lat,
      lng,
      radius
    });

    res.json(listings);
  } catch (error) {
    console.error('Get listings error:', error);
    res.status(500).json({ message: 'Failed to fetch waste listings' });
  }
};

// @desc    Get listings created by the logged-in food business
// @route   GET /api/listings/my-listings
// @access  Private (food_business)
export const getMyListings = async (req, res) => {
  try {
    if (req.user.role !== 'food_business') {
      return res.status(403).json({ message: 'Only Food Businesses can view their logged listings' });
    }

    const listings = await dbService.listings.findByProducer(req.user._id);

    res.json(listings);
  } catch (error) {
    console.error('Get my listings error:', error);
    res.status(500).json({ message: 'Failed to fetch your waste listings' });
  }
};

// @desc    Delete a listing owned by user
// @route   DELETE /api/listings/:id
// @access  Private (food_business)
export const deleteListing = async (req, res) => {
  try {
    const listingId = req.params.id;
    const listing = await dbService.listings.findById(listingId);

    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    const producerId = (listing.producer._id || listing.producer).toString();
    if (producerId !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Unauthorized: You can only delete your own listings' });
    }

    await dbService.listings.delete(listingId);

    res.json({ message: 'Waste listing deleted successfully' });
  } catch (error) {
    console.error('Delete listing error:', error);
    res.status(500).json({ message: 'Failed to delete waste listing' });
  }
};
