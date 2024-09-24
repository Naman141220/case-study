import request from 'supertest';
import server from '../index'; // Adjust this import based on how your server is set up
import { PrismaClient } from "@prisma/client";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();
let testCustomerId, testPlanId, testCustomerPlanId;

describe('User Authentication and Plan Status Endpoints', () => {

  beforeAll(async () => {
    // Ensure the database is in a clean state before tests run
    await prisma.customerPlan.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.plan.deleteMany();

    // Create a test plan
    const plan = await prisma.plan.create({
      data: {
        planName: 'Test Plan',
        ratePerUnit: 10.0,
        description: 'Test plan description',
        billingCycle: 'monthly',
      }
    });

    testPlanId = plan.planId;

    // Create a test customer
    const customer = await prisma.customer.create({
      data: {
        customerName: 'John Doe',
        customerMail: 'johndoe12234@example.com',
        customerPhone: '1234567890',
        customerCurrPlan: testPlanId,
        password: bcrypt.hashSync('password123', 8),
      }
    });

    testCustomerId = customer.customerId;

    // Assign the plan to the customer
    const customerPlan = await prisma.customerPlan.create({
      data: {
        customerId: testCustomerId,
        planId: testPlanId,
        datePurchased: new Date(),
        activationDate: new Date(),
        dueDate: new Date(new Date().setDate(new Date().getDate() + 10)), // Set due date 10 days from now
      }
    });

    testCustomerPlanId = customerPlan.id;
  });

  afterAll(async () => {
    // Clean up the database after all tests are done
    await prisma.$transaction([
      prisma.invoice.deleteMany(),
      prisma.customerPlan.deleteMany(),
      prisma.customer.deleteMany(),
      prisma.plan.deleteMany(),
    ]);

    await prisma.$disconnect(); // Close the Prisma connection after tests

    await new Promise((resolve) => {
      server.close(() => {
        console.log('Server closed.');
        resolve();
      });
    });
  });

  it('should register a new user successfully', async () => {
    const response = await request(server)
      .post('/register')
      .send({
        name: 'John Doe',
        email: 'johndoe12234@example.com',
        password: 'password123',
        phone: '1234567890',
      });

    testCustomerId = response.body.id;  // Store customer ID for use in login test

    expect(response.statusCode).toBe(201);
    expect(response.body.message).toBe('User registered successfully'); // Check for message
  });

  it('should login the user successfully', async () => {
    const response = await request(server)
      .post('/login')
      .send({
        email: 'johndoe12234@example.com',
        password: 'password123',
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.auth).toBe(true);
    expect(response.body.token).toBeDefined(); // Check that token is returned
  });

  it('should fail to login with wrong password', async () => {
    const response = await request(server)
      .post('/login')
      .send({
        email: 'johndoe12234@example.com',
        password: 'wrongpassword',
      });

    expect(response.statusCode).toBe(401);
    expect(response.body.auth).toBe(false);
  });

  it('should fail to login with missing fields', async () => {
    const response = await request(server)
      .post('/login')
      .send({
        email: 'johndoe12234@example.com',
      });

    expect(response.statusCode).toBe(400);
    expect(response.text).toBe('Email and password are required.');
  });

  it('should return the active plan status with valid customerMail', async () => {
    const response = await request(server)
      .post('/checkCustomerPlanStatus')
      .send({
        customerMail: 'johndoe12234@example.com'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Customer's active plan is still valid.");
    expect(response.body.plan.planName).toBe('Test Plan');
    expect(response.body.daysLeft).toBeGreaterThan(0);
  });

  it('should return error if customer is not found', async () => {
    const response = await request(server)
      .post('/checkCustomerPlanStatus')
      .send({
        customerMail: 'nonexistentuser@example.com'
      });

    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe('Customer not found');
  });

  it('should delete the customer plan and reset currPlan if due date has passed', async () => {
    // Update the due date to a past date
    await prisma.customerPlan.update({
      where: { id: testCustomerPlanId },
      data: { dueDate: new Date(new Date().setDate(new Date().getDate() - 1)) } // Set due date to yesterday
    });

    const response = await request(server)
      .post('/checkCustomerPlanStatus')
      .send({
        customerMail: 'johndoe12234@example.com'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Customer has no active plans");

    // Verify that the customer's currPlan was reset to 0
    const updatedCustomer = await prisma.customer.findUnique({
      where: { customerId: testCustomerId }
    });

    expect(updatedCustomer.customerCurrPlan).toBe(0);
  });

  it('should warn when prepaid plan is about to expire', async () => {
    // Update the due date to be within 5 days from now
    await prisma.customerPlan.update({
      where: { id: testCustomerPlanId },
      data: { dueDate: new Date(new Date().setDate(new Date().getDate() + 3)) } // Set due date 3 days from now
    });

    const response = await request(server)
      .post('/checkCustomerPlanStatus')
      .send({
        customerMail: 'johndoe12234@example.com'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Your plan validity is about to expire.");
    expect(response.body.daysLeft).toBeLessThanOrEqual(5);
  });

  it('should generate an invoice for postpaid plan nearing due date', async () => {
    // Set the plan as a postpaid plan and make the due date close
    await prisma.postpaidPlan.create({
      data: {
        planId: testPlanId,
        unitsUsed: 100,
        billingCycle: 'monthly'
      }
    });

    const response = await request(server)
      .post('/checkCustomerPlanStatus')
      .send({
        customerMail: 'johndoe12234@example.com'
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe("Invoice generated as due date is approaching.");
    expect(response.body.invoice).toBeDefined();
  });

});
