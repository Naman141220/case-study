const request = require('supertest'); // For making HTTP requests to your app
const app = require('./rest-endpoints/index1'); // Adjust the path to your Express app
const prisma = require('./prisma/schema.prisma'); // Mock Prisma client
const bcrypt = require('bcryptjs'); // Mock bcrypt
const jwt = require('jsonwebtoken'); // Mock JWT

jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('./prisma/schema.prisma'); // Mock prisma client

describe('POST /register', () => {
  it('should return 400 if any field is missing', async () => {
    const response = await request(app)
      .post('/register')
      .send({ name: '', email: '', password: '', phone: '' });

    expect(response.status).toBe(400);
    expect(response.text).toBe('All fields are required.');
  });

  it('should hash the password and create a new customer', async () => {
    // Mocking bcrypt.hashSync to return a fake hash
    const fakeHash = 'fakeHashedPassword';
    bcrypt.hashSync.mockReturnValue(fakeHash);

    // Mock prisma.customer.create to return a successful result
    const mockCustomer = {
      customerId: 1,
      customerName: 'John Doe',
      customerMail: 'john.doe@example.com',
      customerPhone: '1234567890',
    };
    prisma.customer.create.mockResolvedValue(mockCustomer);

    // Mock jwt.sign to return a fake token
    const fakeToken = 'fakeJwtToken';
    jwt.sign.mockReturnValue(fakeToken);

    const response = await request(app)
      .post('/register')
      .send({
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        phone: '1234567890',
      });

    expect(response.status).toBe(201);
    expect(response.body.auth).toBe(true);
    expect(response.body.token).toBe(fakeToken);
    expect(prisma.customer.create).toHaveBeenCalledWith({
      data: {
        customerId: mockCustomer.customerId,
        customerCurrPlan: 0,
        customerName: 'John Doe',
        customerMail: 'john.doe@example.com',
        customerPhone: '1234567890',
        password: fakeHash,
      },
    });
    expect(bcrypt.hashSync).toHaveBeenCalledWith('password123', 8);
    expect(jwt.sign).toHaveBeenCalledWith({ id: mockCustomer.customerId }, expect.anything(), { expiresIn: 86400 });
  });

  it('should return 500 if there is an error with Prisma', async () => {
    // Mock Prisma to throw an error
    prisma.customer.create.mockRejectedValue(new Error('Prisma Error'));

    const response = await request(app)
      .post('/register')
      .send({
        name: 'John Doe',
        email: 'john.doe@example.com',
        password: 'password123',
        phone: '1234567890',
      });

    expect(response.status).toBe(500);
    expect(response.text).toBe('There was a problem registering the user.');
  });
});
