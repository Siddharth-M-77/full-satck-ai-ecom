import { Router } from 'express';
import { UserController } from './user.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  AddressInputSchema,
  UpdateProfileInputSchema,
} from '@shopsense/shared';

const router = Router();

// All user & address routes require authentication
router.use(authenticate);

router.put(
  '/profile',
  validate({ body: UpdateProfileInputSchema }),
  UserController.updateProfile
);

router.get('/addresses', UserController.getAddresses);

router.post(
  '/addresses',
  validate({ body: AddressInputSchema }),
  UserController.createAddress
);

router.put(
  '/addresses/:id',
  validate({ body: AddressInputSchema.partial() }),
  UserController.updateAddress
);

router.delete('/addresses/:id', UserController.deleteAddress);

router.patch('/addresses/:id/default', UserController.setDefaultAddress);

export const userRouter = router;
