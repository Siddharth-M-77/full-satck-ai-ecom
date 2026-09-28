import { Router, Request, Response, NextFunction } from 'express';
import { CouponService } from './coupon.service.js';

const router = Router();

router.get('/offers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await CouponService.listOffers() });
  } catch (err) {
    next(err);
  }
});

export const couponRouter = router;
