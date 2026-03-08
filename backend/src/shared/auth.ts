import { HttpRequest } from '@azure/functions';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const tenantId = process.env.ENTRA_TENANT_ID || '';
const clientId = process.env.ENTRA_CLIENT_ID || '';

const client = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000,
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  client.getSigningKey(header.kid || '', (err, key) => {
    if (err) return callback(err);
    callback(null, key?.getPublicKey());
  });
}

export interface AuthUser {
  oid: string;
  name: string;
  email: string;
  tid: string;
}

export async function verifyToken(req: HttpRequest): Promise<AuthUser> {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    throw new Error('Authorization header missing');
  }
  const token = authHeader.slice(7);

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: clientId,
        issuer: [
          `https://login.microsoftonline.com/${tenantId}/v2.0`,
          `https://sts.windows.net/${tenantId}/`,
        ],
      },
      (err, decoded) => {
        if (err) return reject(new Error('Invalid token: ' + err.message));
        const payload = decoded as jwt.JwtPayload;
        resolve({
          oid: payload['oid'] || '',
          name: payload['name'] || '',
          email: payload['preferred_username'] || payload['upn'] || '',
          tid: payload['tid'] || '',
        });
      }
    );
  });
}

export function unauthorizedResponse() {
  return { status: 401, jsonBody: { error: '認証が必要です' } };
}
