import { dbService } from '../services/dbService.js';
import { emitNotificationToUser } from '../config/socket.js';

// @desc    Create a pickup request
// @route   POST /api/requests
// @access  Private (biomass_company)
export const createRequest = async (req, res) => {
  try {
    if (req.user.role !== 'biomass_company') {
      return res.status(403).json({ message: 'Only Bio-Energy Recyclers can request waste pickups' });
    }

    const {
      listingId, scheduledTime, notes,
      paymentMethod, paymentStatus, unitPrice, subtotal, logisticsFee, tax, totalAmount, invoiceNumber, transactionId
    } = req.body || {};

    if (!listingId) {
      return res.status(400).json({ message: 'Listing ID is required' });
    }

    const listing = await dbService.listings.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found' });
    }

    if (listing.status !== 'available') {
      return res.status(400).json({ message: 'This waste batch is no longer available for pickup' });
    }

    const producerId = listing.producer._id || listing.producer;
    const invNum = invoiceNumber || `INV-ECO-${Date.now().toString().slice(-6)}`;
    const txId = transactionId || `TXN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

    // Create the pickup order request
    const request = await dbService.requests.create({
      listing: listing._id,
      consumer: req.user._id,
      producer: producerId,
      scheduledTime: scheduledTime ? new Date(scheduledTime) : new Date(),
      status: 'pending',
      notes: notes || '',
      paymentStatus: paymentStatus || (listing.pricingModel === 'priced' ? 'paid' : 'free'),
      paymentMethod: paymentMethod || (listing.pricingModel === 'priced' ? 'upi' : 'free'),
      unitPrice: unitPrice !== undefined ? parseFloat(unitPrice) : (listing.pricePerKg || 0),
      subtotal: subtotal !== undefined ? parseFloat(subtotal) : (listing.totalPrice || 0),
      logisticsFee: logisticsFee !== undefined ? parseFloat(logisticsFee) : 0,
      tax: tax !== undefined ? parseFloat(tax) : 0,
      totalAmount: totalAmount !== undefined ? parseFloat(totalAmount) : (listing.totalPrice || 0),
      invoiceNumber: invNum,
      transactionId: txId
    });

    // Update listing status to 'requested'
    await dbService.listings.update(listing._id, { status: 'requested' });

    // Create & emit real-time notification to the Waste Seller (producer)
    const notification = await dbService.notifications.create({
      recipient: producerId,
      title: '🚚 Pickup Requested!',
      message: `${req.user.name} requested a pickup for ${listing.weight} kg of ${listing.category.replace('_', ' ')}.`,
      type: 'pickup_request'
    });

    emitNotificationToUser(producerId, notification);

    res.status(201).json(request);
  } catch (error) {
    console.error('Create request error:', error);
    res.status(500).json({ message: 'Failed to create pickup request' });
  }
};

// @desc    Get requests for current logged in user (as producer or consumer)
// @route   GET /api/requests/my-requests
// @access  Private
export const getMyRequests = async (req, res) => {
  try {
    const requests = await dbService.requests.findForUser(req.user._id, req.user.role);
    res.json(requests);
  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({ message: 'Failed to fetch pickup requests' });
  }
};

// @desc    Update request status ('accepted', 'declined', 'completed')
// @route   PUT /api/requests/:id
// @access  Private
export const updateRequestStatus = async (req, res) => {
  try {
    const { status } = req.body || {};
    const requestId = req.params.id;

    if (!['accepted', 'declined', 'completed'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const request = await dbService.requests.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: 'Pickup request not found' });
    }

    const listing = await dbService.listings.findById(request.listing._id || request.listing);
    if (!listing) {
      return res.status(404).json({ message: 'Associated listing not found' });
    }

    const producerId = (request.producer._id || request.producer).toString();
    const consumerId = (request.consumer._id || request.consumer).toString();

    // Role verification
    if (req.user.role === 'food_business') {
      if (producerId !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Unauthorized: You do not own this listing request' });
      }

      if (status === 'accepted') {
        await dbService.requests.update(requestId, { status: 'accepted' });
        await dbService.listings.update(listing._id, { status: 'scheduled' });

        const notif = await dbService.notifications.create({
          recipient: consumerId,
          title: '✅ Pickup Request Approved!',
          message: `${req.user.name} approved your pickup request for ${listing.weight} kg of ${listing.category.replace('_', ' ')}.`,
          type: 'status_change'
        });
        emitNotificationToUser(consumerId, notif);

      } else if (status === 'declined') {
        await dbService.requests.update(requestId, { status: 'declined' });
        await dbService.listings.update(listing._id, { status: 'available' });

        const notif = await dbService.notifications.create({
          recipient: consumerId,
          title: '❌ Pickup Request Declined',
          message: `${req.user.name} declined your pickup request for ${listing.weight} kg of ${listing.category.replace('_', ' ')}.`,
          type: 'status_change'
        });
        emitNotificationToUser(consumerId, notif);
      }

    } else if (req.user.role === 'biomass_company') {
      if (consumerId !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Unauthorized: You did not initiate this request' });
      }

      if (status === 'completed') {
        await dbService.requests.update(requestId, { status: 'completed' });
        await dbService.listings.update(listing._id, { status: 'collected' });

        const notif = await dbService.notifications.create({
          recipient: producerId,
          title: '🎉 Recycling Pickup Completed!',
          message: `${req.user.name} completed pickup of ${listing.weight} kg of ${listing.category.replace('_', ' ')}.`,
          type: 'status_change'
        });
        emitNotificationToUser(producerId, notif);

      } else if (status === 'declined') {
        await dbService.requests.update(requestId, { status: 'declined' });
        await dbService.listings.update(listing._id, { status: 'available' });

        const notif = await dbService.notifications.create({
          recipient: producerId,
          title: '⚠️ Pickup Request Canceled',
          message: `${req.user.name} canceled their pickup request for ${listing.weight} kg of ${listing.category.replace('_', ' ')}.`,
          type: 'status_change'
        });
        emitNotificationToUser(producerId, notif);
      }
    }

    const updatedRequest = await dbService.requests.findById(requestId);
    res.json(updatedRequest);
  } catch (error) {
    console.error('Update request error:', error);
    res.status(500).json({ message: 'Failed to update request status' });
  }
};

// @desc    Delete request record
// @route   DELETE /api/requests/:id
// @access  Private
export const deleteRequest = async (req, res) => {
  try {
    const request = await dbService.requests.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ message: 'Pickup request not found' });
    }

    const consumerId = (request.consumer._id || request.consumer).toString();
    const producerId = (request.producer._id || request.producer).toString();
    const currentUserId = req.user._id.toString();

    if (consumerId !== currentUserId && producerId !== currentUserId) {
      return res.status(403).json({ message: 'Unauthorized action' });
    }

    await dbService.requests.delete(req.params.id);

    res.json({ message: 'Request removed successfully' });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ message: 'Failed to delete request' });
  }
};
