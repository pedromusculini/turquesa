import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'medsupapp-dev-secret-key-change-in-production';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  type: 'registration' | 'session';
}

export function signToken(payload: Omit<JwtPayload, 'type'>, type: JwtPayload['type']): string {
  return jwt.sign(
    { ...payload, type },
    JWT_SECRET,
    { expiresIn: type === 'registration' ? '1h' : '7d' }
  );
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}