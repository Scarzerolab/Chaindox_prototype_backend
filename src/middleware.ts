import { Request, Response, NextFunction } from 'express';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const password = req.headers['x-api-password'];

    if (password !== process.env.API_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
};