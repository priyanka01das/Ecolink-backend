import jwt from 'jsonwebtoken';
import { dbService } from '../services/dbService.js';

export const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const JWT_SECRET = process.env.JWT_SECRET || 'ecolink-production-jwt-secret-key-2026';
      
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const user = await dbService.users.findById(decoded.id);
      if (!user) {
        return res.status(401).json({ message: 'Not authorized, user account no longer exists' });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error(`❌ Authentication Error: ${error.message}`);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};

export const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `User role '${req.user ? req.user.role : 'none'}' is not authorized to access this route`
      });
    }
    next();
  };
};
