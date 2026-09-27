import mongoose from 'mongoose';
import { User } from './user.model.js';
import { Address } from './address.model.js';
import { AppError } from '../../utils/app-error.js';
import { AddressInput, UpdateProfileInput } from '@shopsense/shared';

export class UserService {
  static async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await User.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    if (input.name) user.name = input.name;
    await user.save();

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  static async getAddresses(userId: string) {
    return Address.find({ userId: new mongoose.Types.ObjectId(userId) }).sort({
      isDefault: -1,
      createdAt: -1,
    });
  }

  static async createAddress(userId: string, input: AddressInput) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const existingCount = await Address.countDocuments({ userId: userObjectId });

    // First address automatically becomes default
    const shouldBeDefault = input.isDefault || existingCount === 0;

    if (shouldBeDefault) {
      await Address.updateMany(
        { userId: userObjectId },
        { $set: { isDefault: false } }
      );
    }

    const address = new Address({
      ...input,
      userId: userObjectId,
      isDefault: shouldBeDefault,
    });

    await address.save();
    return address;
  }

  static async updateAddress(
    userId: string,
    addressId: string,
    input: Partial<AddressInput>
  ) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const address = await Address.findOne({
      _id: addressId,
      userId: userObjectId,
    });

    if (!address) {
      throw AppError.notFound('Address not found');
    }

    if (input.isDefault) {
      await Address.updateMany(
        { userId: userObjectId, _id: { $ne: addressId } },
        { $set: { isDefault: false } }
      );
    }

    Object.assign(address, input);
    await address.save();
    return address;
  }

  static async deleteAddress(userId: string, addressId: string) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const address = await Address.findOneAndDelete({
      _id: addressId,
      userId: userObjectId,
    });

    if (!address) {
      throw AppError.notFound('Address not found');
    }

    // If deleted address was default, promote the most recently created remaining address
    if (address.isDefault) {
      const nextAddress = await Address.findOne({ userId: userObjectId }).sort({
        createdAt: -1,
      });
      if (nextAddress) {
        nextAddress.isDefault = true;
        await nextAddress.save();
      }
    }

    return { deleted: true };
  }

  static async setDefaultAddress(userId: string, addressId: string) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const address = await Address.findOne({
      _id: addressId,
      userId: userObjectId,
    });

    if (!address) {
      throw AppError.notFound('Address not found');
    }

    await Address.updateMany(
      { userId: userObjectId },
      { $set: { isDefault: false } }
    );

    address.isDefault = true;
    await address.save();
    return address;
  }
}
