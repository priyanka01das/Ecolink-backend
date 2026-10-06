import express from 'express';
import {
  createRequest,
  getMyRequests,
  updateRequestStatus,
  deleteRequest
} from '../controllers/requestController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', protect, createRequest);
router.get('/my-requests', protect, getMyRequests);
router.put('/:id', protect, updateRequestStatus);
router.delete('/:id', protect, deleteRequest);

export default router;
