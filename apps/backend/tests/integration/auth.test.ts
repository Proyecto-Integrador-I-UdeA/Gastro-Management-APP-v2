import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';

const ADMIN_ROLE_NAME = 'admin';
const COLLABORATOR_ROLE_NAME = '__auth_test_collaborator__';
const JWT_SECRET = process.env.JWT_SECRET || 'tu-secreto-super-seguro';
const TEST_USER_EMAILS = [
  'status-existing@example.test',
  'owner@example.test',
  'second-owner@example.test',
  'collaborator@example.test',
];

let adminRoleCreatedByTests = false;
let collaboratorRoleId: number;
let collaboratorRoleCreatedByTests = false;

async function clearUsers() {
  await prisma.user.deleteMany({
    where: { email: { in: TEST_USER_EMAILS } },
  });
}

async function createUser(email: string, roleId: number) {
  return prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash('password-seguro', 4),
      fullName: 'Usuario de prueba',
      roleId,
      active: true,
    },
  });
}

function createToken(permissions: string[]) {
  return jwt.sign(
    {
      id: 999_999,
      email: 'actor-auth-test@example.test',
      role: 'test',
      permissions,
    },
    JWT_SECRET,
    { expiresIn: '5m' },
  );
}

beforeAll(async () => {
  const existingAdmin = await prisma.role.findUnique({
    where: { name: ADMIN_ROLE_NAME },
    select: { id: true },
  });

  if (!existingAdmin) {
    await prisma.role.create({ data: { name: ADMIN_ROLE_NAME } });
    adminRoleCreatedByTests = true;
  }

  const existingCollaboratorRole = await prisma.role.findUnique({
    where: { name: COLLABORATOR_ROLE_NAME },
    select: { id: true },
  });
  const collaboratorRole = existingCollaboratorRole ?? await prisma.role.create({
    data: { name: COLLABORATOR_ROLE_NAME },
    select: { id: true },
  });
  collaboratorRoleCreatedByTests = !existingCollaboratorRole;
  collaboratorRoleId = collaboratorRole.id;
});

beforeEach(async () => {
  await clearUsers();
});

afterAll(async () => {
  await clearUsers();
  if (collaboratorRoleCreatedByTests) {
    await prisma.rolePermission.deleteMany({
      where: { roleId: collaboratorRoleId },
    });
    await prisma.role.deleteMany({
      where: { name: COLLABORATOR_ROLE_NAME },
    });
  }

  if (adminRoleCreatedByTests) {
    await prisma.rolePermission.deleteMany({
      where: { role: { name: ADMIN_ROLE_NAME } },
    });
    await prisma.role.deleteMany({
      where: { name: ADMIN_ROLE_NAME },
    });
  }

  await prisma.$disconnect();
});

describe('GET /auth/register/status', () => {
  it('indica que el registro está disponible cuando no hay usuarios', async () => {
    const response = await request(app).get('/auth/register/status');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ registrationAvailable: true });
    expect(JSON.stringify(response.body)).not.toContain('email');
  });

  it('indica que el registro no está disponible cuando existe un usuario', async () => {
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { name: ADMIN_ROLE_NAME },
      select: { id: true },
    });
    await createUser('status-existing@example.test', adminRole.id);

    const response = await request(app).get('/auth/register/status');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ registrationAvailable: false });
    expect(JSON.stringify(response.body)).not.toContain('status-existing@example.test');
  });
});

describe('POST /auth/register', () => {
  const validPayload = {
    email: 'owner@example.test',
    password: 'password-seguro',
    fullName: 'Admin Inicial',
  };

  it('crea el primer usuario activo con el rol admin y respuesta segura', async () => {
    const response = await request(app).post('/auth/register').send(validPayload);

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      email: validPayload.email,
      fullName: validPayload.fullName,
      active: true,
      role: { name: ADMIN_ROLE_NAME },
    });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');

    const persistedUser = await prisma.user.findUniqueOrThrow({
      where: { email: validPayload.email },
      include: { role: { select: { name: true } } },
    });
    expect(persistedUser.fullName).toBe(validPayload.fullName);
    expect(persistedUser.active).toBe(true);
    expect(persistedUser.role?.name).toBe(ADMIN_ROLE_NAME);
  });

  it('rechaza una contraseña menor de ocho caracteres sin crear usuario', async () => {
    const response = await request(app).post('/auth/register').send({
      ...validPayload,
      password: 'corta',
    });

    expect(response.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it('rechaza fullName ausente sin crear usuario', async () => {
    const { fullName: _fullName, ...payloadWithoutFullName } = validPayload;
    const response = await request(app).post('/auth/register').send(payloadWithoutFullName);

    expect(response.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it('rechaza roleId enviado públicamente sin crear usuario', async () => {
    const response = await request(app).post('/auth/register').send({
      ...validPayload,
      roleId: collaboratorRoleId,
    });

    expect(response.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });

  it('rechaza un segundo registro y conserva un único usuario', async () => {
    const firstResponse = await request(app).post('/auth/register').send(validPayload);
    expect(firstResponse.status).toBe(201);

    const secondResponse = await request(app).post('/auth/register').send({
      ...validPayload,
      email: 'second-owner@example.test',
    });

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.error).toBe('El registro inicial ya fue completado');
    expect(await prisma.user.count()).toBe(1);
  });

  it('responde de forma controlada si el rol admin no existe', async () => {
    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { name: ADMIN_ROLE_NAME },
      select: { id: true },
    });
    const temporaryName = `__auth_test_admin_missing_${Date.now()}__`;

    await prisma.role.update({
      where: { id: adminRole.id },
      data: { name: temporaryName },
    });

    try {
      const response = await request(app).post('/auth/register').send(validPayload);

      expect(response.status).toBe(503);
      expect(response.body.error).toContain('rol admin no está configurado');
      expect(await prisma.user.count()).toBe(0);
    } finally {
      await prisma.role.update({
        where: { id: adminRole.id },
        data: { name: ADMIN_ROLE_NAME },
      });
    }
  });
});

describe('POST /users', () => {
  const collaboratorPayload = {
    email: 'collaborator@example.test',
    password: 'password-seguro',
    fullName: 'Colaborador de Prueba',
  };

  it('rechaza solicitudes sin token', async () => {
    const response = await request(app).post('/users').send({
      ...collaboratorPayload,
      roleId: collaboratorRoleId,
    });

    expect(response.status).toBe(401);
    expect(await prisma.user.count()).toBe(0);
  });

  it('rechaza usuarios autenticados sin users.create', async () => {
    const response = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${createToken([])}`)
      .send({ ...collaboratorPayload, roleId: collaboratorRoleId });

    expect(response.status).toBe(403);
    expect(await prisma.user.count()).toBe(0);
  });

  it('permite crear un colaborador con users.create y devuelve una respuesta segura', async () => {
    const response = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${createToken(['users.create'])}`)
      .send({ ...collaboratorPayload, roleId: collaboratorRoleId });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({
      email: collaboratorPayload.email,
      fullName: collaboratorPayload.fullName,
      active: true,
      role: { id: collaboratorRoleId, name: COLLABORATOR_ROLE_NAME },
    });
    expect(JSON.stringify(response.body)).not.toContain('passwordHash');
    expect(await prisma.user.count()).toBe(1);
  });

  it('rechaza email duplicado sin crear otro usuario', async () => {
    await createUser(collaboratorPayload.email, collaboratorRoleId);

    const response = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${createToken(['users.create'])}`)
      .send({ ...collaboratorPayload, roleId: collaboratorRoleId });

    expect(response.status).toBe(409);
    expect(await prisma.user.count({ where: { email: collaboratorPayload.email } })).toBe(1);
  });

  it('rechaza un roleId inexistente sin crear usuario', async () => {
    const lastRole = await prisma.role.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    const nonexistentRoleId = (lastRole?.id ?? 0) + 10_000;

    const response = await request(app)
      .post('/users')
      .set('Authorization', `Bearer ${createToken(['users.create'])}`)
      .send({ ...collaboratorPayload, roleId: nonexistentRoleId });

    expect(response.status).toBe(400);
    expect(await prisma.user.count()).toBe(0);
  });
});
