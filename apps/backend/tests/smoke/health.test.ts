import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../../src/app';

describe('GET /', () => {
  it('responde con el health check sin abrir un puerto', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: '¡Backend de Gastro Management API funcionando!',
    });
  });
});
