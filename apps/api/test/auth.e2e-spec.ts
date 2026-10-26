import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AuthService } from '../src/auth/auth.service';
import { createApp } from './app';

describe('auth', () => {
  let app: INestApplication;
  beforeAll(async () => (app = await createApp()));
  afterAll(async () => app.close());

  const email = 'Martin@Example.com';
  const password = 'correct-horse-battery';

  it('registers, sets an httpOnly session cookie and normalises the email', async () => {
    const res = await request(app.getHttpServer()).post('/api/auth/register').send({ email, password, name: 'Martin' }).expect(201);
    expect(res.body.user).toMatchObject({ email: 'martin@example.com', name: 'Martin', onboarded: false });
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^cp_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it('stores the UI language and lets the user change it', async () => {
    const agent = request.agent(app.getHttpServer());
    const res = await agent.post('/api/auth/register').send({ email: 'bg@example.com', password, locale: 'bg' }).expect(201);
    expect(res.body.user.locale).toBe('bg');
    await agent.patch('/api/auth/me').send({ locale: 'en', name: 'Ivan' }).expect(200);
    await agent.get('/api/auth/me').expect((r) => expect(r.body).toMatchObject({ locale: 'en', name: 'Ivan' }));
    await agent.patch('/api/auth/me').send({ locale: 'de' }).expect(400);
  });

  it('rejects a duplicate email and weak passwords', async () => {
    await request(app.getHttpServer()).post('/api/auth/register').send({ email, password }).expect(409);
    await request(app.getHttpServer()).post('/api/auth/register').send({ email: 'new@example.com', password: 'short' }).expect(400);
  });

  it('logs in and reads /me via cookie and via bearer token', async () => {
    const agent = request.agent(app.getHttpServer());
    const login = await agent.post('/api/auth/login').send({ email, password }).expect(200);
    expect(login.body.accessToken).toBeUndefined(); // browsers only get the httpOnly cookie
    await agent.get('/api/auth/me').expect(200).expect((r) => expect(r.body.email).toBe('martin@example.com'));
    const native = await request(app.getHttpServer()).post('/api/auth/login').set('X-Clearplate-Client', 'native').send({ email, password }).expect(200);
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${native.body.accessToken}`).expect(200);
  });

  it('gives the same error for a wrong password and an unknown email', async () => {
    const a = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: 'wrong-password-123' }).expect(401);
    const b = await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'nobody@example.com', password }).expect(401);
    expect(a.body.message).toBe(b.body.message);
  });

  it('protects routes by default and keeps health public', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });

  it('reports social providers as disabled without credentials and 404s their routes', async () => {
    await request(app.getHttpServer()).get('/api/auth/providers').expect(200, { email: true, google: false, facebook: false });
    await request(app.getHttpServer()).get('/api/auth/google').expect(404);
  });

  it('logout-all revokes every issued token', async () => {
    const e = 'revoke@example.com';
    await request(app.getHttpServer()).post('/api/auth/register').send({ email: e, password }).expect(201);
    const a = await request(app.getHttpServer()).post('/api/auth/login').set('X-Clearplate-Client', 'native').send({ email: e, password });
    const b = await request(app.getHttpServer()).post('/api/auth/login').set('X-Clearplate-Client', 'native').send({ email: e, password });
    await request(app.getHttpServer()).post('/api/auth/logout-all').set('Authorization', `Bearer ${a.body.accessToken}`).expect(204);
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${b.body.accessToken}`).expect(401);
  });

  it('a verified social login takes over a pre-registered email and kills the squatter password', async () => {
    const e = 'victim@example.com';
    const squatter = await request(app.getHttpServer()).post('/api/auth/register').set('X-Clearplate-Client', 'native').send({ email: e, password }).expect(201);
    const auth = app.get(AuthService);
    await expect(auth.socialLogin('google', 'g-unverified', e, false)).rejects.toThrow();
    const user = await auth.socialLogin('google', 'g-123', e, true, 'Victim');
    expect(user.email).toBe(e);
    await request(app.getHttpServer()).post('/api/auth/login').send({ email: e, password }).expect(401);
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${squatter.body.accessToken}`).expect(401);
  });

  it('deletes the account and invalidates the token', async () => {
    const agent = request.agent(app.getHttpServer());
    const { body } = await agent.post('/api/auth/login').set('X-Clearplate-Client', 'native').send({ email, password }).expect(200);
    await agent.delete('/api/auth/me').expect(204);
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${body.accessToken}`).expect(401);
  });
});
