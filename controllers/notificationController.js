import { dbService } from '../services/dbService.js';

// @desc    Get user notifications
// @route   GET /api/notifications
// @access  Private
export const getNotifications = async (req, res) => {
  try {
    const notifications = await dbService.notifications.findForUser(req.user._id);
    res.json(notifications);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    const success = await dbService.notifications.markRead(req.params.id);
    if (!success) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Mark read notification error:', error);
    res.status(500).json({ message: 'Failed to mark notification as read' });
  }
};
