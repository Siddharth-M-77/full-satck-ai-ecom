import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service.js';

export class UserController {
  static async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await UserService.updateProfile(
        req.user!._id.toString(),
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAddresses(req: Request, res: Response, next: NextFunction) {
    try {
      const addresses = await UserService.getAddresses(req.user!._id.toString());
      res.status(200).json({
        success: true,
        data: addresses,
      });
    } catch (err) {
      next(err);
    }
  }

  static async createAddress(req: Request, res: Response, next: NextFunction) {
    try {
      const address = await UserService.createAddress(
        req.user!._id.toString(),
        req.body
      );

      res.status(201).json({
        success: true,
        message: 'Address added successfully',
        data: address,
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateAddress(req: Request, res: Response, next: NextFunction) {
    try {
      const addressId = req.params.id as string;
      const address = await UserService.updateAddress(
        req.user!._id.toString(),
        addressId,
        req.body
      );

      res.status(200).json({
        success: true,
        message: 'Address updated successfully',
        data: address,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteAddress(req: Request, res: Response, next: NextFunction) {
    try {
      const addressId = req.params.id as string;
      await UserService.deleteAddress(req.user!._id.toString(), addressId);

      res.status(200).json({
        success: true,
        message: 'Address removed successfully',
      });
    } catch (err) {
      next(err);
    }
  }

  static async setDefaultAddress(req: Request, res: Response, next: NextFunction) {
    try {
      const addressId = req.params.id as string;
      const address = await UserService.setDefaultAddress(
        req.user!._id.toString(),
        addressId
      );

      res.status(200).json({
        success: true,
        message: 'Default address updated',
        data: address,
      });
    } catch (err) {
      next(err);
    }
  }
}
