import { INestApplication } from '@nestjs/common';
import request from 'supertest';
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

  it('rejects a duplicate email and weak passwords', async () => {
    await request(app.getHttpServer()).post('/api/auth/register').send({ email, password }).expect(409);
    await request(app.getHttpServer()).post('/api/auth/register').send({ email: 'new@example.com', password: 'short' }).expect(400);
  });

  it('logs in and reads /me via cookie and via bearer token', async () => {
    const agent = request.agent(app.getHttpServer());
    const login = await agent.post('/api/auth/login').send({ email, password }).expect(200);
    await agent.get('/api/auth/me').expect(200).expect((r) => expect(r.body.email).toBe('martin@example.com'));
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`).expect(200);
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

  it('deletes the account and invalidates the token', async () => {
    const agent = request.agent(app.getHttpServer());
    const { body } = await agent.post('/api/auth/login').send({ email, password }).expect(200);
    await agent.delete('/api/auth/me').expect(204);
    await request(app.getHttpServer()).get('/api/auth/me').set('Authorization', `Bearer ${body.accessToken}`).expect(401);
  });
});
