import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbService } from '../services/dbService.js';

const generateToken = (id, role) => {
  const JWT_SECRET = process.env.JWT_SECRET || 'ecolink-production-jwt-secret-key-2026';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ id: id.toString(), role }, JWT_SECRET, { expiresIn });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res) => {
  try {
    const { name, email, password, role, phone, altPhone, address, coordinates, photo } = req.body || {};

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Name, email, password, and role are required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if email already registered
    const existingUser = await dbService.users.findByEmail(cleanEmail);
    if (existingUser) {
      return res.status(400).json({ message: 'Email address is already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // GeoJSON Location format: [longitude, latitude]
    let locationObj = {
      type: 'Point',
      coordinates: [72.8777, 19.0760] // Mumbai default
    };

    if (coordinates && Array.isArray(coordinates) && coordinates.length === 2) {
      const lng = parseFloat(coordinates[0]);
      const lat = parseFloat(coordinates[1]);
      if (!isNaN(lng) && !isNaN(lat)) {
        locationObj.coordinates = [lng, lat];
      }
    }

    const user = await dbService.users.create({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      role,
      photo: photo || '',
      contact: {
        phone: phone || '',
        altPhone: altPhone || '',
        address: address || ''
      },
      location: locationObj
    });

    const token = generateToken(user._id, user.role);

    const userResponse = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      photo: user.photo,
      contact: user.contact,
      location: user.location,
      createdAt: user.createdAt
    };

    res.status(201).json({
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during user registration' });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await dbService.users.findByEmail(cleanEmail);
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = generateToken(user._id, user.role);

    const userResponse = {
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      photo: user.photo,
      contact: user.contact,
      location: user.location,
      createdAt: user.createdAt
    };

    res.json({
      token,
      user: userResponse
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// @desc    Get current authenticated user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await dbService.users.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User profile not found' });
    }

    res.json({
      _id: user._id,
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      photo: user.photo,
      contact: user.contact,
      location: user.location,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('GetMe error:', error);
    res.status(500).json({ message: 'Error retrieving user profile' });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateProfile = async (req, res) => {
  try {
    const { name, phone, altPhone, address, photo, coordinates } = req.body || {};

    const updates = {};
    if (name) updates.name = name.trim();
    if (photo !== undefined) updates.photo = photo;

    const currentContact = req.user.contact || {};
    updates.contact = {
      phone: phone !== undefined ? phone : (currentContact.phone || ''),
      altPhone: altPhone !== undefined ? altPhone : (currentContact.altPhone || ''),
      address: address !== undefined ? address : (currentContact.address || '')
    };

    if (coordinates && Array.isArray(coordinates) && coordinates.length === 2) {
      const lng = parseFloat(coordinates[0]);
      const lat = parseFloat(coordinates[1]);
      if (!isNaN(lng) && !isNaN(lat)) {
        updates.location = {
          type: 'Point',
          coordinates: [lng, lat]
        };
      }
    }

    const updatedUser = await dbService.users.update(req.user._id, updates);

    res.json({
      _id: updatedUser._id,
      id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      photo: updatedUser.photo,
      contact: updatedUser.contact,
      location: updatedUser.location,
      createdAt: updatedUser.createdAt
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Error updating user profile' });
  }
};

// @desc    Generate password reset code
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await dbService.users.findByEmail(cleanEmail);

    if (!user) {
      return res.status(404).json({ message: 'No registered account found with this email' });
    }

    // Generate random 6-digit verification code
    const demoCode = Math.floor(100000 + Math.random() * 900000).toString();

    await dbService.users.update(user._id, {
      resetPasswordCode: demoCode,
      resetPasswordExpires: new Date(Date.now() + 10 * 60 * 1000)
    });

    console.log(`🔑 Password Reset Code for [${cleanEmail}]: ${demoCode}`);

    const responsePayload = {
      message: 'Password reset code generated successfully.'
    };

    if (process.env.NODE_ENV !== 'production') {
      responsePayload.demoCode = demoCode;
    }

    res.json(responsePayload);
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error generating password reset code' });
  }
};

// @desc    Reset password using verification code
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword } = req.body || {};

    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: 'Email, verification code, and new password are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await dbService.users.findByEmail(cleanEmail);

    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    if (!user.resetPasswordCode || user.resetPasswordCode !== code) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    if (user.resetPasswordExpires && new Date() > new Date(user.resetPasswordExpires)) {
      await dbService.users.update(user._id, { resetPasswordCode: null, resetPasswordExpires: null });
      return res.status(400).json({ message: 'Verification code has expired. Please request a new code.' });
    }

    // Hash new password and save
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await dbService.users.update(user._id, {
      password: hashedPassword,
      resetPasswordCode: null,
      resetPasswordExpires: null
    });

    res.json({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error during password reset' });
  }
};
