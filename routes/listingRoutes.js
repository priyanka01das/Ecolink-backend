import express from 'express';
import {
  createListing,
  getListings,
  getMyListings,
  deleteListing
} from '../controllers/listingController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.route('/')
  .post(protect, createListing)
  .get(protect, getListings);

router.get('/my-listings', protect, getMyListings);
router.delete('/:id', protect, deleteListing);

export default router;
