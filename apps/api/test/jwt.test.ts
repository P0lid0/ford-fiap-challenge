/**
 * Testes unitários — geração e validação do JWT (lib/jwt.ts).
 */
import { describe, expect, it } from 'vitest';
import { SignJWT, UnsecuredJWT, decodeJwt } from 'jose';
import { env } from '../src/config.js';
import { isIssuedByThisApi, signAccessToken, TokenError, verifyAccessToken } from '../src/lib/jwt.js';

const secret = new TextEncoder().encode(env.JWT_SECRET);
const now = () => Math.floor(Date.now() / 1000);
const subject = { id: 'user-1', email: 'gestor@faroai.test', role: 'gestor' as const, dealershipId: 'dealer-1' };

/** Token assinado manualmente, para montar cenários inválidos. */
function craftToken(claims: Record<string, unknown> = {}) {
  return new SignJWT({ email: 'x@faroai.test', role: 'admin', dealership_id: null, ...claims })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-1')
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt();
}

async function expectTokenError(token: string, code: 'token_expired' | 'invalid_token') {
  const error = await verifyAccessToken(token).catch((e) => e);
  expect(error).toBeInstanceOf(TokenError);
  expect(error.code).toBe(code);
}

describe('JWT — geração', () => {
  it('gera token HS256 com as claims registradas e as de autorização', async () => {
    const { accessToken, expiresIn } = await signAccessToken(subject);
    const claims = decodeJwt(accessToken);

    expect(expiresIn).toBe(env.JWT_EXPIRES_IN_SECONDS);
    expect(claims).toMatchObject({
      sub: 'user-1',
      email: 'gestor@faroai.test',
      role: 'gestor',
      dealership_id: 'dealer-1',
      iss: env.JWT_ISSUER,
      aud: env.JWT_AUDIENCE,
    });
    expect(claims.exp! - claims.iat!).toBe(env.JWT_EXPIRES_IN_SECONDS);
    expect(claims.jti).toBeTypeOf('string');
  });

  it('gera um jti diferente a cada emissão', async () => {
    const first = decodeJwt((await signAccessToken(subject)).accessToken);
    const second = decodeJwt((await signAccessToken(subject)).accessToken);
    expect(first.jti).not.toBe(second.jti);
  });
});

describe('JWT — validação', () => {
  it('aceita token válido e devolve os dados do usuário', async () => {
    const { accessToken } = await signAccessToken(subject);
    await expect(verifyAccessToken(accessToken)).resolves.toEqual(subject);
  });

  it('rejeita token expirado com token_expired', async () => {
    const token = await craftToken().setIssuedAt(now() - 7200).setExpirationTime(now() - 60).sign(secret);
    await expectTokenError(token, 'token_expired');
  });

  it('rejeita token com payload adulterado (analista → admin)', async () => {
    const { accessToken } = await signAccessToken({ ...subject, role: 'analista' });
    const [header, payload, signature] = accessToken.split('.');
    const forged = { ...JSON.parse(Buffer.from(payload!, 'base64url').toString()), role: 'admin' };
    const tampered = `${header}.${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${signature}`;
    await expectTokenError(tampered, 'invalid_token');
  });

  it('rejeita token assinado com outro segredo', async () => {
    const token = await craftToken().setExpirationTime('1h').sign(new TextEncoder().encode('x'.repeat(40)));
    await expectTokenError(token, 'invalid_token');
  });

  it('rejeita token de outro emissor (iss)', async () => {
    const token = await craftToken().setIssuer('outro-sistema').setExpirationTime('1h').sign(secret);
    await expectTokenError(token, 'invalid_token');
  });

  it('rejeita token para outra audiência (aud)', async () => {
    const token = await craftToken().setAudience('outra-api').setExpirationTime('1h').sign(secret);
    await expectTokenError(token, 'invalid_token');
  });

  it('rejeita token sem assinatura (alg: none)', async () => {
    const unsigned = new UnsecuredJWT({ role: 'admin', email: 'x', dealership_id: null })
      .setSubject('user-1').setIssuer(env.JWT_ISSUER).setAudience(env.JWT_AUDIENCE).setExpirationTime('1h').encode();
    await expectTokenError(unsigned, 'invalid_token');
  });

  it('rejeita token bem assinado mas com perfil desconhecido', async () => {
    const token = await craftToken({ role: 'superuser' }).setExpirationTime('1h').sign(secret);
    await expectTokenError(token, 'invalid_token');
  });

  it('rejeita texto que não é JWT', async () => {
    await expectTokenError('isto-nao-e-um-jwt', 'invalid_token');
  });
});

describe('JWT — identificação do emissor', () => {
  it('reconhece tokens emitidos por esta API', async () => {
    const { accessToken } = await signAccessToken(subject);
    expect(isIssuedByThisApi(accessToken)).toBe(true);
  });

  it('não reconhece tokens de outro emissor nem texto inválido', async () => {
    const other = await craftToken().setIssuer('https://outro-provedor.test/auth/v1').setExpirationTime('1h').sign(secret);
    expect(isIssuedByThisApi(other)).toBe(false);
    expect(isIssuedByThisApi('lixo')).toBe(false);
  });
});
