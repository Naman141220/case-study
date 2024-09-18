import dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
import swaggerUi from "swagger-ui-express";
import swaggerSpec from './swaggerConfig.js'; 
import express from "express";
import bodyParser from "body-parser";
import cors from "cors"; // Import cors
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

import {
  Customer,
  Invoice,
  Plan,
  PostpaidPlan,
  PrepaidPlan,
} from "../telecom-billing-system.js";




const app = express();
const PORT = 9099;
const SECRET_KEY = process.env.JWT_SECRET;

// Configure CORS
const corsOptions = {
  origin: '*', // Allow all origins. Change this to a specific domain for more control
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization' , 'x-access-token'],
};

app.use(cors(corsOptions)); // Use the CORS middleware

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(bodyParser.json());

let customers = {};

const dummyCustomers = [
  {
    id: "customer1",
    name: "Jim",
    email: "Jim@example.com",
    password: bcrypt.hashSync("password123", 8),
  },
  {
    id: "customer2",
    name: "Dwight",
    email: "Dwight@example.com",
    password: bcrypt.hashSync("password456", 8),
  },
];

const admins = [
  {
    email: "sampreetireddy19@gmail.com",
    password: "adminPassword123",  
  },
  {
    email: "namansharma@gmail.com",
    password: "adminPassword456",
  },
];


const custIds = dummyCustomers.forEach((customer) => {
  customers[customer.id] = {
    ...customer,
    invoices: [],
  };
});

function verifyToken(req, res, next) {
  const token = req.headers['x-access-token'];
  if (!token) {
    return res.status(403).send('No token provided.');
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(500).send('Failed to authenticate token.');
    }
    req.customerId = decoded.id;
    next();
  });
}


/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new customer
 *     tags: 
 *       - Customers
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *               email:
 *                 type: string
 *                 example: johndoe@ex.com
 *               password:
 *                 type: string
 *                 example: password123
 *               phone:
 *                 type: string
 *                 example: 1234567890
 *     responses:
 *       201:
 *         description: Customer registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 auth:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: All fields are required
 *       500:
 *         description: There was a problem registering the user
 */
// Register customer route
app.post('/register', async (req, res) => {
  const { name, email, password, phone } = req.body;

  if (!name || !email || !password || !phone) {
    return res.status(400).send('All fields are required.');
  }

  const hashedPassword = bcrypt.hashSync(password, 8);

  try {
    let newCustomer = new Customer(name, email, phone, password);
    newCustomer = await prisma.customer.create({
      data: {
        customerId: newCustomer.customerId,
        customerCurrPlan: 0,
        customerName: name,
        customerMail: email,
        customerPhone: phone,
        password: hashedPassword,
      },
    });

    const token = jwt.sign({ id: newCustomer.customerId }, SECRET_KEY, {
      expiresIn: 86400, // 24 hours
    });

    res.status(201).send({ auth: true, token });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).send('There was a problem registering the user.');
  }
});

let loggedInCustomers = [];

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Log in a customer
 *     tags: 
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: johndoe@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Customer logged in successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 auth:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Email and password are required
 *       401:
 *         description: Invalid password
 *       404:
 *         description: No user found
 *       500:
 *         description: There was a problem logging in
 */

// Login customer route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send('Email and password are required.');
  }

  try {
    // Check if the user is an admin first
    const admin = admins.find((admin) => admin.email === email && admin.password === password);
    
    if (admin) {
      const token = jwt.sign({ isAdmin: true }, SECRET_KEY, { expiresIn: 86400 });
      return res.status(200).send({
        message: "Admin login successful.",
        token: token,
        isAdmin: true,
      });
    }

    // If not admin, check if the user is a customer
    const customer = await prisma.customer.findFirst({
      where: { customerMail: email },
    });

    if (!customer) {
      return res.status(404).send('No user found.');
    }

    // Validate password for the customer
    const passwordIsValid = bcrypt.compareSync(password, customer.password);
    if (!passwordIsValid) {
      return res.status(401).send({ auth: false, token: null });
    }

    // Generate a token for the customer
    const token = jwt.sign({ id: customer.customerId, isAdmin: false }, SECRET_KEY, {
      expiresIn: 86400, // 24 hours
    });

    // Keep track of logged-in customers if necessary
    loggedInCustomers.push(customer.customerId);

    res.status(200).send({
      message: "Customer login successful.",
      auth: true,
      token: token,
      customerId: customer.customerId,
      name: customer.name,
      email: customer.customerMail,
      isAdmin: false,
    });
  } catch (error) {
    res.status(500).send('There was a problem logging in.');
  }
});


/**
 * @swagger
 * /admin/addPlan:
 *   post:
 *     summary: Add a new plan
 *     description: Creates a new plan and adds it to the database. Supports both prepaid and postpaid plans.
 *     tags:
 *       - Plans
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               planName:
 *                 type: string
 *                 description: The name of the plan
 *                 example: "Basic Plan"
 *               ratePerUnit:
 *                 type: number
 *                 description: The rate per unit for the plan
 *                 example: 0.05
 *               planType:
 *                 type: string
 *                 description: The type of the plan (PREPAID or POSTPAID)
 *                 example: "PREPAID"
 *               prepaidBalance:
 *                 type: number
 *                 description: The prepaid balance for prepaid plans
 *                 example: 100
 *               billingCycle:
 *                 type: string
 *                 description: The billing cycle for postpaid plans
 *                 example: "MONTHLY"
 *     responses:
 *       201:
 *         description: Plan created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 plan:
 *                   type: object
 *                   properties:
 *                     planId:
 *                       type: string
 *                       description: The ID of the plan
 *                     planName:
 *                       type: string
 *                       description: The name of the plan
 *                     ratePerUnit:
 *                       type: number
 *                       description: The rate per unit for the plan
 *                 prepaidPlan:
 *                   type: object
 *                   properties:
 *                     planId:
 *                       type: string
 *                       description: The ID of the prepaid plan
 *                     unitsAvailable:
 *                       type: number
 *                       description: The units available for the prepaid plan
 *                     prepaidBalance:
 *                       type: number
 *                       description: The prepaid balance
 *                 postpaidPlan:
 *                   type: object
 *                   properties:
 *                     planId:
 *                       type: string
 *                       description: The ID of the postpaid plan
 *                     unitsUsed:
 *                       type: number
 *                       description: The units used for the postpaid plan
 *                     billingCycle:
 *                       type: string
 *                       description: The billing cycle
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 *                   example: "Missing prepaidBalance for prepaid plan"
 */

app.post("/admin/addPlan", async (req, res) => {
  const { planName, ratePerUnit, planType, prepaidBalance, billingCycle, description } = req.body;
  let newPlan = new Plan(planName, ratePerUnit, planType);
  try {
    // Check if the plan already exists
    const existingPlan = await prisma.plan.findUnique({
      where: { planName }
    });

    if (existingPlan) {
      return res.status(400).json({ error: "Plan with this name already exists" });
    }

    // Create the plan in the Plan table
     newPlan = await prisma.plan.create({
      data: {
        planName,
        ratePerUnit,
        description,
        planId : newPlan.planId
      },
    });

    if (planType === "PREPAID") {
      // Ensure that prepaidBalance is provided for PREPAID plans
      if (prepaidBalance === undefined) {
        return res.status(400).json({ error: "Missing prepaidBalance for prepaid plan" });
      }

      // Create an entry in PrepaidPlan table
      const prepaidPlan = await prisma.prepaidPlan.create({
        data: {
          planId: newPlan.planId,
          unitsAvailable: prepaidBalance / ratePerUnit, // Calculate units available
          prepaidBalance
        },
      });

      res.status(201).json({ plan: newPlan, prepaidPlan });

    } else if (planType === "POSTPAID") {
      // Ensure that billingCycle is provided for POSTPAID plans
      if (!billingCycle) {
        return res.status(400).json({ error: "Missing billingCycle for postpaid plan" });
      }

      // Create an entry in PostpaidPlan table
      const postpaidPlan = await prisma.postpaidPlan.create({
        data: {
          planId: newPlan.planId,
          unitsUsed: 0, // Default value for units used
          billingCycle
        },
      });

      res.status(201).json({ plan: newPlan, postpaidPlan });

    } else {
      // If planType is neither PREPAID nor POSTPAID, return an error
      return res.status(400).json({ error: "Invalid plan type" });
    }

  } catch (error) {
    console.error("Error adding plan:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Generate invoice route
app.post("/generateInvoice", async (req, res) => {
  const { customerMail } = req.body;
  if (!customerMail) {
    return res.status(400).send('Customer email is required.');
  }
  try {
    const customer = await prisma.customer.findUnique({
      where: { customerMail },
    });
    console.log(customer)
    const planId = customer.customerCurrPlan;
    console.log(planId);
    const plan = await prisma.plan.findUnique({
      where: { planId },
      include: {
        prepaidPlans: true,
        postpaidPlans: true,
      },
    });

    if (!customer) {
      return res.status(404).send("Customer not found.");
    }

    if (!planId) {
      return res.status(400).send("Plan ID is required.");
    }

    let planType;
    let createdInvoice;
    if (plan.prepaidPlans.length > 0) {
      planType = "PREPAID";
      const date = new Date();
      const invoice = new Invoice(
        customer.customerName,
        customer.customerId,
        plan,
        plan.prepaidPlans[0].unitsAvailable,
        date,
        planType,
        plan.prepaidPlans[0].prepaidBalance
      );
      createdInvoice = await prisma.invoice.create({
        data: {
          invoiceId: invoice.invoiceId,
          customerName: customer.customerName,
          customerId: customer.customerId,
          planId: plan.planId,
          units: plan.prepaidPlans[0].unitsAvailable,
          date,
          amount: plan.prepaidPlans[0].prepaidBalance,
          planType,
        },
      });
    } else if (plan.postpaidPlans.length > 0) {
      planType = "POSTPAID";
      const date = new Date();
      const invoice = new Invoice(
        customer.customerName,
        customer.customerId,
        plan,
        plan.postpaidPlans[0].unitsUsed,
        date,
        planType,
        plan.postpaidPlans[0].unitsUsed * plan.ratePerUnit
      );
      createdInvoice = await prisma.invoice.create({
        data: {
          invoiceId: invoice.invoiceId,
          customerName: customer.customerName,
          customerId:customer.customerId,
          planId: plan.planId,
          units: plan.postpaidPlans[0].unitsUsed,
          date,
          amount: plan.postpaidPlans[0].unitsUsed * plan.ratePerUnit,
          planType,
        },
      });
    } else {
      return res.status(400).send("Invalid plan type.");
    }

    res.send({
      message: "Invoice generated successfully.",
      invoice: createdInvoice,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error.");
  }
});

/**
 * @swagger
 * /buyPlan:
 *   post:
 *     summary: Buy a plan for a customer
 *     tags: 
 *       - Plans
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerMail:
 *                 type: string
 *                 example: johndoe@example.com
 *               planName:
 *                 type: string
 *                 example: Basic Plan
 *               planType:
 *                 type: string
 *                 enum: [PREPAID, POSTPAID]
 *                 example: PREPAID
 *     responses:
 *       201:
 *         description: Plan purchased successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 customer:
 *                   type: object
 *                   properties:
 *                     customerId:
 *                       type: integer
 *                       example: 1
 *                     customerName:
 *                       type: string
 *                       example: John Doe
 *                     customerMail:
 *                       type: string
 *                       example: johndoe@example.com
 *                     customerCurrPlan:
 *                       type: integer
 *                       example: 101
 *                     customerType:
 *                       type: string
 *                       example: PREPAID
 *                 plan:
 *                   type: object
 *                   properties:
 *                     planId:
 *                       type: integer
 *                       example: 101
 *                     planName:
 *                       type: string
 *                       example: Basic Plan
 *                     ratePerUnit:
 *                       type: number
 *                       example: 1.5
 *                     prepaidPlans:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           prepaidBalance:
 *                             type: number
 *                             example: 100.0
 *                           unitsAvailable:
 *                             type: integer
 *                             example: 100
 *                     postpaidPlans:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           billingCycle:
 *                             type: string
 *                             example: Monthly
 *                           unitsUsed:
 *                             type: integer
 *                             example: 50
 *                 invoice:
 *                   type: object
 *                   properties:
 *                     invoiceId:
 *                       type: string
 *                       example: 12345
 *                     customerName:
 *                       type: string
 *                       example: John Doe
 *                     customerId:
 *                       type: integer
 *                       example: 1
 *                     planId:
 *                       type: integer
 *                       example: 101
 *                     units:
 *                       type: integer
 *                       example: 100
 *                     date:
 *                       type: string
 *                       format: date-time
 *                       example: 2024-09-05T03:40:12.851Z
 *                     amount:
 *                       type: number
 *                       example: 500.00
 *                     planType:
 *                       type: string
 *                       example: PREPAID
 *       400:
 *         description: Plan not found or Invalid plan type
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Internal server error
 */

app.post("/buyPlan", async (req, res) => {
  const { planId, userEmail } = req.body;

  try {
    // Fetch the plan using planId
    const plan = await prisma.plan.findUnique({
      where: { planId },
      include: {
        prepaidPlans: true,
        postpaidPlans: true
      }
    });

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    let planType, ratePerUnit;

    // Determine if it's a prepaid or postpaid plan
    if (plan.prepaidPlans.length > 0) {
      planType = 'PREPAID';
      ratePerUnit = plan.prepaidPlans[0].prepaidBalance; // Assuming prepaidBalance is used for the amount
    } else if (plan.postpaidPlans.length > 0) {
      planType = 'POSTPAID';
      ratePerUnit = plan.ratePerUnit; // Assuming ratePerUnit is used for the amount
    } else {
      return res.status(400).json({ error: "Plan type not recognized" });
    }

    // Fetch customer information based on userEmail
    const customer = await prisma.customer.findUnique({
      where: { customerMail: userEmail }
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const customerId = customer.customerId;
    const customerName = customer.customerName;

    // Create an invoice using the custom class
    const now = new Date();
    const invoice = new Invoice(
      customerName,
      customerId,
      plan,
      0, // Default or calculated units based on your logic
      now,
      planType,
      ratePerUnit // Amount based on the plan rate
    );

    // Save the invoice to the database
    const createdInvoice = await prisma.invoice.create({
      data: {
        invoiceId: invoice.invoiceId,
        customerName: invoice.customerName,
        customerId: invoice.customerId,
        planId: plan.planId,
        units: invoice.units,
        amount: invoice.amount,
        planType: invoice.planType,
        date: invoice.date,
      },
    });

    // Update customer's current plan
    const updatedCustomer = await prisma.customer.update({
      where: { customerMail: userEmail },
      data: { customerCurrPlan: plan.planId },
    });

    let customer_Plan = await prisma.customerPlan.create({
      data: {
        customerId: customer.customerId,
        planId:plan.planId,
      },
    });

    res.status(201).json({ message: "Payment successful", invoice: createdInvoice ,customer_Plan});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * @swagger
 * /admin/addCustomer:
 *   post:
 *     summary: Add a new customer
 *     description: Creates a new customer and adds them to the database.
 *     tags:
 *       - Customers
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerName:
 *                 type: string
 *                 description: The name of the customer
 *                 example: "John Doe"
 *               customerMail:
 *                 type: string
 *                 description: The email of the customer
 *                 example: "john.doe@example.com"
 *               customerPhone:
 *                 type: string
 *                 description: The phone number of the customer
 *                 example: "+1234567890"
 *     responses:
 *       201:
 *         description: Customer created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 cust:
 *                   type: object
 *                   properties:
 *                     customerId:
 *                       type: string
 *                       description: The ID of the customer
 *                     customerName:
 *                       type: string
 *                       description: The name of the customer
 *                     customerCurrPlan:
 *                       type: number
 *                       description: The current plan of the customer
 *                     customerMail:
 *                       type: string
 *                       description: The email of the customer
 *                     customerPhone:
 *                       type: string
 *                       description: The phone number of the customer
 *                     password:
 *                       type: string
 *                       description: The password for the customer account
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 *                   example: "Invalid input data"
 */
app.post("/admin/addCustomer", async (req, res) => {
  const { customerName, customerMail, customerPhone } = req.body;
  let cust = new Customer(customerName, customerMail, customerPhone);
  // let cl_head = cl.insertCustomer(req.body)
  console.log(JSON.stringify(cust, null, 2));
  // let i = new Invoice(123,cl_head.obj.customerId)

  // const invoicesData = invoiceList.map(invoiceId=>({
  //     invoiceId: invoiceId,
  //     customerId: cl_head.obj.customerId
  // }))
  let dataobj = {
    data: {
      customerId: cust.customerId,
      customerName: customerName,
      customerCurrPlan: 0,
      customerMail: customerMail,
      customerPhone: customerPhone,
      password:"admin"
      // invoiceList:{
      //     create: invoicesData
      // }
    },
  };
  console.log(dataobj)
  await prisma.customer.create(dataobj);
  // res.send({
  //   id: cust.customerId,
  //   name: cust.customerName,
  //   plan: 0,
  //   mail: cust.customerMail,
  //   phone: cust.customerPhone,
  //   // invoiceList : cl_head.obj.invoiceList
  // });
  res.status(201).json({cust})
  console.log(cust.customerName);
  // cl.printToEnd(cl_head)
  // cl.printToEnd(cl_head)
});

/**
 * @swagger
 * /invoices:
 *   post:
 *     summary: Get invoices for a customer
 *     description: Retrieves all invoices for a customer based on their email.
 *     tags:
 *       - Invoices
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customerMail:
 *                 type: string
 *                 description: The email of the customer
 *                 example: "john.doe@example.com"
 *     responses:
 *       200:
 *         description: A list of invoices
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   invoiceId:
 *                     type: string
 *                     description: The ID of the invoice
 *                   customerId:
 *                     type: string
 *                     description: The ID of the customer
 *                   amount:
 *                     type: number
 *                     description: The amount of the invoice
 *                   date:
 *                     type: string
 *                     format: date-time
 *                     description: The date of the invoice
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 *                   example: "Invalid input data"
 */
app.post("/invoices",async (req, res) => {
  const {customerMail} = req.body
  const customer = await prisma.customer.findUnique({
    where:{customerMail:customerMail}
  })
  let invoices = []
  invoices = await prisma.invoice.findMany({
    where:{customerId:customer.customerId}
  })
  res.send(invoices)
  // console.log(invoices)
});

/**
 * @swagger
 * /invoices/{invoiceId}:
 *   get:
 *     summary: Get invoice by ID
 *     description: Retrieves a specific invoice based on the invoice ID.
 *     tags:
 *       - Invoices
 *     parameters:
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the invoice
 *         example: 123
 *     responses:
 *       200:
 *         description: Invoice retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invoiceId:
 *                   type: integer
 *                   description: The ID of the invoice
 *                 customerId:
 *                   type: string
 *                   description: The ID of the customer
 *                 amount:
 *                   type: number
 *                   description: The amount of the invoice
 *                 date:
 *                   type: string
 *                   format: date-time
 *                   description: The date of the invoice
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 *                   example: "Invalid invoice ID"
 */
app.get("/invoices/:invoiceId", async (req, res) => {
  let {invoiceId} = req.params
  invoiceId = parseInt(invoiceId,10)
  // const {customerMail} = req.body
  let invoice_res = await prisma.invoice.findUnique({
    where:{invoiceId:invoiceId}
  })
  res.send(invoice_res)
});

/**
 * @swagger
 * /payInvoice:
 *   post:
 *     summary: Pay an invoice
 *     description: Marks an invoice as paid for a specific customer.
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               invoiceId:
 *                 type: integer
 *                 description: The ID of the invoice to be paid
 *                 example: 123
 *     responses:
 *       200:
 *         description: Invoice paid successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   description: Success message
 *                   example: "Invoice 123 for customer 456 has been paid."
 *                 invoice:
 *                   type: object
 *                   properties:
 *                     invoiceId:
 *                       type: integer
 *                       description: The ID of the invoice
 *                     customerId:
 *                       type: string
 *                       description: The ID of the customer
 *                     amount:
 *                       type: number
 *                       description: The amount of the invoice
 *                     date:
 *                       type: string
 *                       format: date-time
 *                       description: The date of the invoice
 *                     paid:
 *                       type: boolean
 *                       description: Payment status of the invoice
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 *                   example: "Invoice is already paid."
 *       404:
 *         description: Not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   description: Error message
 *                   example: "Customer not found."
 */
app.post("/payInvoice", verifyToken, (req, res) => {
  const { invoiceId } = req.body;
  const customerId = req.customerId;

  if (!customers[customerId]) {
    return res.status(404).send("Customer not found.");
  }

  const invoice = customers[customerId].invoices.find(
    (inv) => inv.invoiceId === invoiceId
  );

  if (!invoice) {
    return res.status(404).send("Invoice not found.");
  }

  if (invoice.paid) {
    return res.status(400).send("Invoice is already paid.");
  }

  invoice.paid = true;
  res.send({
    message: `Invoice ${invoiceId} for customer ${customerId} has been paid.`,
    invoice,
  });
});


app.get("/prepaidPlans", async (req, res) => {
  try {
    // Fetch all prepaid plans from the database, including related plan data
    const prepaidPlans = await prisma.prepaidPlan.findMany({
      include: {
        plan: true,  // Include related Plan data
      },
    });

    // Map the results to include planName from the related Plan data
    const prepaidPlansWithNames = prepaidPlans.map(prepaidPlan => ({
      id: prepaidPlan.id,
      planId: prepaidPlan.planId,
      unitsAvailable: prepaidPlan.unitsAvailable,
      prepaidBalance: prepaidPlan.prepaidBalance,
      planName: prepaidPlan.plan.planName,
      planDescription : prepaidPlan.plan.description // Include planName
    }));

    // If no prepaid plans are found, return a 404 response
    if (!prepaidPlansWithNames || prepaidPlansWithNames.length === 0) {
      return res.status(404).json({ error: "No prepaid plans found" });
    }

    // Return the prepaid plans with plan names as a response
    res.status(200).json({ prepaidPlans: prepaidPlansWithNames });
  } catch (error) {
    console.error("Error fetching prepaid plans:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/postpaidPlans", async (req, res) => {
  try {
    // Fetch all postpaid plans from the database, including related plan data
    const postpaidPlans = await prisma.postpaidPlan.findMany({
      include: {
        plan: true,  // Include related Plan data
      },
    });

    // Map the results to include planName from the related Plan data
    const postpaidPlansWithNames = postpaidPlans.map(postpaidPlan => ({
      id: postpaidPlan.id,
      planId: postpaidPlan.planId,
      unitsUsed: postpaidPlan.unitsUsed,
      billingCycle: postpaidPlan.billingCycle,
      planName: postpaidPlan.plan.planName, // Include planName
      planDescription : postpaidPlan.plan.description
    }));

    // If no postpaid plans are found, return a 404 response
    if (!postpaidPlansWithNames || postpaidPlansWithNames.length === 0) {
      return res.status(404).json({ error: "No postpaid plans found" });
    }

    // Return the postpaid plans with plan names as a response
    res.status(200).json({ postpaidPlans: postpaidPlansWithNames });
  } catch (error) {
    console.error("Error fetching postpaid plans:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/viewHistory", async (req, res) => {
  const { customerMail } = req.body;
 
  // Query to fetch a customer and their plansList
  const customerWithPlans = await prisma.customer.findUnique({
    where: { customerMail: customerMail }, // or use customerMail if that's your lookup field
    include: {
      plansList: true, // This includes the list of plans associated with the customer
    },
  });
 
  if (!customerWithPlans) {
    return res.status(404).json({ error: "Customer does not exist" });
  }
 
  // Accessing the plansList
  const plansList = customerWithPlans.plansList;
 
  if (plansList.length === 0) {
    return res.status(200).json({ message: "Customer has no previous plans" });
  }
 
  // Now you can use `plansList` as needed
  // console.log(plansList);
  res.status(200).json({ customer: customerWithPlans, plansList });
});

app.post("/viewPlan",async (req,res)=>{
 
  const {planId} = req.body
  let plan = await prisma.plan.findUnique({
    where:{
      planId:planId
    }
  })
 
  res.status(201).json({plan})
})



// Listen on the port
module.exports=app
