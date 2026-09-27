import { IUser } from '../modules/users/user.model.js';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}
