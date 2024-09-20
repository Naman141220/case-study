import dotenv from "dotenv";
dotenv.config();
import PDFDocument from 'pdfkit';
import { PrismaClient } from "@prisma/client";
// const {PrismaClient} = require("@prisma/client")
const prisma = new PrismaClient();
import swaggerUi, { generateHTML } from "swagger-ui-express";
import swaggerSpec from './swaggerConfig.js'; 
import express from "express";
import bodyParser from "body-parser";
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
import { LinkedList } from "../LinkedList.js";
const app = express();
const PORT = 9099;
const SECRET_KEY = process.env.JWT_SECRET;
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

// Function to handle units usage logic
async function useUnitsForCustomer(customerMail) {
  let customer = await prisma.customer.findUnique({
    where: { customerMail },
    include: {
      plansList: {
        include: {
          plan: {
            include: {
              prepaidPlans: true,
              postpaidPlans: true
            }
          }
        }
      }
    }
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  let customerPlan = customer.plansList.find(cp => cp.planId === customer.customerCurrPlan);
  
  if (!customerPlan) {
    throw new Error("Customer does not have a valid plan");
  }

  let plan = customerPlan.plan;
  let planInstance;
  let planType;

  if (plan.prepaidPlans.length > 0) {
    // Handle Prepaid Plans
    planInstance = plan.prepaidPlans[0];
    planType = 'PREPAID';

    // Assume that using units involves updating prepaid balance or similar logic
    // For demonstration, let's simulate unit usage for prepaid plans
    let unitsToUse = Math.floor(Math.random() * 100) + 1; // Example units to use
    planInstance.prepaidBalance -= unitsToUse;

    await prisma.prepaidPlan.update({
      where: { id: planInstance.id },
      data: { prepaidBalance: planInstance.prepaidBalance },
    });
  } else if (plan.postpaidPlans.length > 0) {
    // Handle Postpaid Plans
    planInstance = plan.postpaidPlans[0];
    planType = 'POSTPAID';

    // Simulate unit usage for postpaid plans
    let randomNum = Math.floor(Math.random() * (401 / 5)) * 5 + 100;
    planInstance.unitsUsed += randomNum;

    await prisma.postpaidPlan.update({
      where: { id: planInstance.id },
      data: { unitsUsed: planInstance.unitsUsed },
    });
  } else {
    throw new Error("No valid plan found for the customer");
  }

  return {
    planInstance,
    planType
  };
}


// Function to generate an invoice
async function generateInvoiceForCustomer(customerMail) {
  const customer = await prisma.customer.findUnique({
    where: { customerMail },
  });

  if (!customer) {
    throw new Error("Customer not found");
  }

  const planId = customer.customerCurrPlan;
  const plan = await prisma.plan.findUnique({
    where: { planId },
    include: {
      prepaidPlans: true,
      postpaidPlans: true,
    },
  });

  if (!planId) {
    throw new Error("Plan ID is required");
  }

  let planType;
  let createdInvoice;
  const date = new Date();

  if (plan.prepaidPlans.length > 0) {
    planType = "PREPAID";

    createdInvoice = new Invoice(
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
        invoiceId:createdInvoice.invoiceId,
        customerName: customer.customerName,
        customerId: customer.customerId,
        planId: plan.planId,
        units: plan.prepaidPlans[0].unitsAvailable,
        date,
        amount: plan.prepaidPlans[0].prepaidBalance,
        planType,
        status: "not paid",
      },
    });
  } else if (plan.postpaidPlans.length > 0) {
    planType = "POSTPAID";
     createdInvoice = new Invoice(
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
        invoiceId:createdInvoice.invoiceId,
        customerName: customer.customerName,
        customerId: customer.customerId,
        planId: plan.planId,
        units: plan.postpaidPlans[0].unitsUsed,
        date,
        amount: plan.postpaidPlans[0].unitsUsed * plan.ratePerUnit,
        planType,
        status: "not paid",
      },
    });
  } else {
    throw new Error("Invalid plan type");
  }

  return createdInvoice;
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
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).send('Email and password are required.');
  }

  try {
    const customer = await prisma.customer.findFirst({
      where: { customerMail: email },
    });

    if (!customer) {
      return res.status(404).send('No user found.');
    }

    const passwordIsValid = bcrypt.compareSync(password, customer.password);

    if (!passwordIsValid) {
      return res.status(401).send({ auth: false, token: null });
    }

    const token = jwt.sign({ id: customer.customerId }, SECRET_KEY, {
      expiresIn: 86400, // 24 hours
    });

    loggedInCustomers.push(customer.customerId);

    console.log(loggedInCustomers[0]);
    res.status(200).send({ auth: true, token });
  } catch (error) {
    res.status(500).send('There was a problem logging in.');
  }
});


app.post("/checkCustomerPlanStatus", async (req, res) => {
  const { customerMail } = req.body;

  try {
    // Fetch customer using customerMail
    let customer = await prisma.customer.findUnique({
      where: { customerMail: customerMail },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Fetch the customer's active plan using customerCurrPlan
    let customerPlan = await prisma.customerPlan.findUnique({
      where: {
        customerId_planId: {
          customerId: customer.customerId,
          planId: customer.customerCurrPlan, // currPlan is the active planId
        },
      },
    });

    if (!customerPlan) {
      return res.status(404).json({ error: "Customer plan not found" });
    }

    // Get the current date
    let now = new Date();

    // Check if the current date is past the due date
    if (now > customerPlan.dueDate) {
      // Delete the customerPlan entry
      await prisma.customerPlan.delete({
        where: { id: customerPlan.id },
      });

      // Reset the customer's currPlan to 0 (default)
      await prisma.customer.update({
        where: { customerId: customer.customerId },
        data: { customerCurrPlan: 0 },
      });

      return res.status(200).json({
        message: "Customer has no active plans",
      });
    }

    // If the due date has not passed, check days left
    let timeDifference = customerPlan.dueDate.getTime() - now.getTime();
    let daysLeft = Math.ceil(timeDifference / (1000 * 3600 * 24));

    // Fetch plan type
    let plan = await prisma.plan.findUnique({
      where: { planId: customer.customerCurrPlan },
      include: {
        prepaidPlans: true,
        postpaidPlans: true
      }
    });

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    let planType;
    if (plan.prepaidPlans.length > 0) {
      planType = 'PREPAID';
    } else if (plan.postpaidPlans.length > 0) {
      planType = 'POSTPAID';
    } else {
      return res.status(404).json({ error: "Plan type not found" });
    }

    if (planType === 'PREPAID') {
      if (daysLeft <= 5) {
        return res.status(200).json({
          message: "Your plan validity is about to expire.",
          daysLeft,
          plan
        });
      } else {
        return res.status(200).json({
          message: "Customer's active plan is still valid.",
          daysLeft,
          plan
        });
      }
    } else if (planType === 'POSTPAID') {
      if (daysLeft <= 5) {
        // Use units and generate invoice
        await useUnitsForCustomer(customerMail);
        const generatedInvoice = await generateInvoiceForCustomer(customerMail);

        return res.status(200).json({
          message: "Invoice generated as due date is approaching.",
          invoice: generatedInvoice,
          plan
        });
      } else {
        return res.status(200).json({
          message: "Customer's active plan is still valid.",
          daysLeft,
          plan
        });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});



app.post("/admin/setDueDateTwoDaysFromNow", async (req, res) => {
  const { customerMail } = req.body;

  try {
    // Fetch customer using customerMail
    let customer = await prisma.customer.findUnique({
      where: { customerMail: customerMail },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Fetch the customer's active plan using customerCurrPlan
    let customerPlan = await prisma.customerPlan.findUnique({
      where: {
        customerId_planId: {
          customerId: customer.customerId,
          planId: customer.customerCurrPlan, // currPlan is the active planId
        },
      },
    });

    if (!customerPlan) {
      return res.status(404).json({ error: "Customer plan not found" });
    }

    // Set the dueDate to two days from the current date
    let now = new Date();
    let newDueDate = new Date(now);
    newDueDate.setDate(now.getDate() + 2);

    // Update the customer's plan with the new due date
    customerPlan = await prisma.customerPlan.update({
      where: { id: customerPlan.id },
      data: { dueDate: newDueDate },
    });

    res.status(200).json({
      message: "Due date updated to two days from now.",
      customerPlan,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});


/**
 * @swagger
 * /generateInvoice:
 *   post:
 *     summary: Generate an invoice for a customer
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
 *                 example: johndoe@example.com
 *     responses:
 *       200:
 *         description: Invoice generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Invoice generated successfully.
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
 *         description: Plan ID is required or Invalid plan type
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Internal server error
 */
app.post("/generateInvoice", async (req, res) => {
  const { customerMail } = req.body;

  try {
    const customer = await prisma.customer.findUnique({
      where: { customerMail },
    });
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
          customerId:customer.customerId,
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
          status: "not paid",
          planType,
        },
      });
    } else {
      return res.status(400).send("Invalid plan type.");
    }

    // const date = new Date();
    // const invoice = new Invoice(customer.customerName, customer.customerId, plan, units, date, planType, amount);
    // const createdInvoice = await prisma.invoice.create({
    //   data: {
    //     invoiceId:invoice.invoiceId,
    //     customerName: customer.customerName,
    //     customerId,
    //     planId: plan.planId,
    //     units,
    //     date,
    //     amount,
    //     planType
    //   },
    // });

    res.send({
      message: "Invoice generated successfully.",
      invoice: createdInvoice,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal server error.");
  }
});

app.post("/payPostpaidInvoice", async (req, res) => {
  const { customerMail, invoiceId, changePlan } = req.body;

  try {
    // Fetch customer using customerMail
    let customer = await prisma.customer.findUnique({
      where: { customerMail: customerMail },
    });

    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Fetch invoice by invoiceId
    let invoice = await prisma.invoice.findUnique({
      where: { invoiceId: invoiceId },
    });

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    // Fetch the plan using planId from the invoice
    let plan = await prisma.plan.findUnique({
      where: { planId: invoice.planId },
    });

    if (!plan) {
      return res.status(404).json({ error: "Plan not found" });
    }

    // Update the invoice status to 'paid'
    invoice = await prisma.invoice.update({
      where: { invoiceId: invoiceId },
      data: { status: "paid" },
    });

    if (changePlan) {
      // If changePlan is true, delete the customerPlan entry and set the customer's currPlan to 0
      let customerPlan = await prisma.customerPlan.findUnique({
        where: {
          customerId_planId: {
            customerId: customer.customerId,
            planId: customer.customerCurrPlan, // currPlan is the active planId
          },
        },
      });
      // Update the customer's `plansList`
    customer = await prisma.customer.update({
      where: { customerMail: customerMail },
      data: {
        plansList: {
          connect: { id: customerPlan.id },
        },
        customerCurrPlan: 0,
      },
      include: {
        plansList: true, // Fetch the updated plansList
      },
    });

      if (customerPlan) {
        // Delete the customerPlan entry
        await prisma.customerPlan.delete({
          where: { id: customerPlan.id },
        });
      }

      // Set the customer's currPlan to 0 (default)
      customer = await prisma.customer.update({
        where: { customerId: customer.customerId },
        data: { customerCurrPlan: 0 },
      });
    } else {
      // If changePlan is false, update the plan's dueDate, activationDate, and datePurchased in the customerPlan table

      let customerPlan = await prisma.customerPlan.findUnique({
        where: {
          customerId_planId: {
            customerId: customer.customerId,
            planId: customer.customerCurrPlan, // currPlan is the active planId
          },
        },
      });

      // Update the customer's `plansList`
    customer = await prisma.customer.update({
      where: { customerMail: customerMail },
      data: {
        plansList: {
          connect: { id: customerPlan.id },
        },
        customerCurrPlan: plan.planId,
      },
      include: {
        plansList: true, // Fetch the updated plansList
      },
    });

      if (!customerPlan) {
        return res.status(404).json({ error: "Customer plan not found" });
      }

      // Update customerPlan with new dates
      let now = new Date();
      let dueDateSet = new Date(now);
      dueDateSet.setDate(now.getDate() + parseInt(plan.billingCycle)); // Set due date based on plan's billing cycle

      await prisma.customerPlan.update({
        where: { id: customerPlan.id },
        data: {
          activationDate: now,
          dueDate: dueDateSet,
          datePurchased: now,
        },
      });

      let invoiceData = {
        customerName: customer.customerName,
        customerId: customer.customerId,
        planId: plan.planId,
        date: now,
        planType: "POSTPAID"
      };
  
      let newInvoice = new Invoice(invoiceData); 
      // Generate a new invoice with status 'N/A'
      newInvoice = await prisma.invoice.create({
        data: {
          invoiceId:newInvoice.invoiceId,
          customerName: customer.customerName,
          customerId: customer.customerId,
          planId: plan.planId,
          units: 0, // Assuming units are the same for the new invoice
          date: now,
          status: "N/A", // New invoice status
          amount: 0, // Assuming amount remains the same
          planType: invoice.planType, // Assuming plan type remains the same
        },
      });

      return res.status(200).json({
        message: "Invoice paid and same plan subscribed successfully",
        invoice,
        newInvoice,
        customer,
      });
    }

    res.status(200).json({
      message: "Invoice paid successfully",
      invoice,
      customer,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
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
  const { customerMail, planName, planType } = req.body;
  let plan, planInstance;

  try {
    // Debugging Logs
    console.log("Fetching customer:", customerMail);
    
    // Fetch the customer from the database
    let customer = await prisma.customer.findUnique({
      where: { customerMail: customerMail },
      include: {
        plansList: true, // Include the related plans
        invoiceList: true, // Include existing invoices
      },
    });

    if (!customer) {
      console.log("Customer not found");
      return res.status(404).json({ error: "Customer not found" });
    }

    let now = new Date();  // Current date for activationDate
    console.log("Current date:", now);
    if (isNaN(now.getTime())) {
      throw new Error("Invalid current date");
    }

    let dueDateSet = null; // Default value for dueDate

    // Fetch the plan from the database
    console.log("Fetching plan:", planName);
    plan = await prisma.plan.findFirst({
      where: { planName: planName },
      include: { prepaidPlans: true, postpaidPlans: true },
    });

    if (!plan) {
      console.log("Plan not found");
      return res.status(404).json({ error: "Plan not found" });
    }

    // Prepaid Plan Logic
    if (planType === "PREPAID" && plan.prepaidPlans.length > 0) {
      planInstance = plan.prepaidPlans[0];
      console.log("Prepaid plan instance found:", planInstance);

      // No billingCycle for Prepaid plan, so set some default expiration logic or continue
      dueDateSet = new Date(now);
      dueDateSet.setDate(now.getDate() + 30); // Default to a 30-day expiration for prepaid plan
    } 
    // Postpaid Plan Logic
    else if (planType === "POSTPAID" && plan.postpaidPlans.length > 0) {
      planInstance = plan.postpaidPlans[0];
      console.log("Postpaid plan instance found:", planInstance);

      // Calculate the actual due date for POSTPAID plan based on the billing cycle
      dueDateSet = new Date(now);
      const billingCycleDays = parseInt(planInstance.billingCycle);
      if (isNaN(billingCycleDays)) {
        console.log("Invalid billing cycle for postpaid plan");
        throw new Error("Invalid billing cycle for postpaid plan");
      }
      dueDateSet.setDate(now.getDate() + billingCycleDays);  // Billing cycle in days
    } else {
      console.log("Plan instance not found");
      return res.status(404).json({ error: "Plan instance not found" });
    }

    console.log("Due date set:", dueDateSet);

    if (isNaN(dueDateSet.getTime())) {
      throw new Error("Invalid due date calculation");
    }

    // Check if the customer already has this plan assigned
    const existingCustomerPlan = await prisma.customerPlan.findUnique({
      where: {
        customerId_planId: {
          customerId: customer.customerId,
          planId: plan.planId,
        },
      },
    });

    if (existingCustomerPlan) {
      console.log("Customer already has this plan assigned");
      return res.status(400).json({ error: "Customer already has this plan assigned." });
    }

    // Save the customer-plan association with the correct dates
    let customerPlanData;
    if (planType === "PREPAID") {
      customerPlanData = {
        customerId: customer.customerId,
        planId: plan.planId,
        activationDate: now.toISOString(),
        dueDate: dueDateSet.toISOString(), // Prepaid plan expiration based on billing cycle
      };
    } else if (planType === "POSTPAID") {
      customerPlanData = {
        customerId: customer.customerId,
        planId: plan.planId,
        activationDate: now.toISOString(),
        dueDate: dueDateSet.toISOString(), // Calculated due date for postpaid plans
      };
    }

    console.log("Creating customer plan:", customerPlanData);

    // Create the CustomerPlan with the dynamically constructed data
    let customerPlan = await prisma.customerPlan.create({
      data: customerPlanData,
    });

    customer = await prisma.customer.update({
      where: { customerMail: customerMail },
      data: {
        plansList: {
          connect: { id: customerPlan.id },
        },
        customerCurrPlan: plan.planId,
      },
      include: {
        plansList: true, // Fetch the updated plansList
      },
    });
    console.log("Customer plan created:", customerPlan);

    // Create a new invoice
    let invoiceData = {
      customerName: customer.customerName,
      customerId: customer.customerId,
      planId: plan.planId,
      date: now,
      planType: planType
    };

    let invoice = new Invoice(invoiceData); 
    invoiceData.invoiceId = invoice.invoiceId;
 
    if (planType === "PREPAID") {
      invoiceData.units = planInstance.unitsAvailable;
      invoiceData.amount = planInstance.prepaidBalance; // Prepaid balance charged upfront
      invoiceData.status = "paid"
    } else if (planType === "POSTPAID") {
      invoiceData.units = planInstance.unitsUsed;
      invoiceData.amount = 0; // No upfront amount for POSTPAID
      invoiceData.status = "N/A"
    }

    console.log("Creating invoice:", invoiceData);

    customer = await prisma.customer.update({
      where: { customerMail: customerMail },
      data: { customerCurrPlan: plan.planId },
    });

    const createdInvoice = await prisma.invoice.create({
      data: invoiceData,
    });

    console.log("Invoice created:", createdInvoice);

    // Respond with the updated customer, plan, and invoice information
    res.status(201).json({
      message: "Plan added to customer successfully",
      customerPlan,
      customer,
      plan,
      invoice: createdInvoice,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Internal server error" });
  }
});

/**
 * @swagger
 * /viewHistory:
 *   post:
 *     summary: View the plan history of a customer
 *     tags: 
 *       - Customers
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
 *     responses:
 *       200:
 *         description: Successfully retrieved customer plan history
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
 *                     planList:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           planId:
 *                             type: integer
 *                             example: 101
 *                           planName:
 *                             type: string
 *                             example: Basic Plan
 *                           ratePerUnit:
 *                             type: number
 *                             example: 1.5
 *       404:
 *         description: Customer not found
 *       500:
 *         description: Internal server error
 */
app.post("/viewHistory", async (req, res) => {
  const { customerMail } = req.body;

  try {
    // Fetch the customer along with their invoices and associated plans
    const customerWithInvoices = await prisma.customer.findUnique({
      where: { customerMail },
      include: {
        invoiceList: {
          where: {
            OR: [
              { status: "paid" },
              { status: "N/A" },
            ],
          },
          orderBy: { date: 'desc' }, // Order invoices by date in descending order
          include: {
            plan: true, // Include the plan details in the invoices
          },
        },
      },
    });

    if (!customerWithInvoices) {
      return res.status(404).json({ error: "Customer does not exist" });
    }

    // Extract unique plan IDs from the filtered invoices
    const uniquePlanMap = new Map();

    customerWithInvoices.invoiceList.forEach(invoice => {
      if (!uniquePlanMap.has(invoice.planId)) {
        uniquePlanMap.set(invoice.planId, invoice.plan);
      }
    });

    const plansList = Array.from(uniquePlanMap.values());

    if (plansList.length === 0) {
      return res.status(200).json({ message: "Customer has no relevant plans in invoice history" });
    }

    // Respond with the customer's details and the list of unique plans
    res.status(200).json({
      customer: {
        customerId: customerWithInvoices.customerId,
        customerName: customerWithInvoices.customerName,
        customerMail: customerWithInvoices.customerMail,
      },
      plansList,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});



app.post("/viewInvoiceHistory", async(req,res)=>{
  const { customerMail } = req.body;
  
  // Query to fetch a customer and their plansList
  const customerWithInvoices = await prisma.customer.findUnique({
    where: { customerMail: customerMail }, // or use customerMail if that's your lookup field
    include: {
      invoiceList: true, // This includes the list of plans associated with the customer
    },
  });

  if (!customerWithInvoices) {
    return res.status(404).json({ error: "Customer does not exist" });
  }

  // Accessing the plansList
  const invoiceList = customerWithInvoices.invoiceList;

  if (invoiceList.length === 0) {
    return res.status(200).json({ message: "Customer has no previous Invoices" });
  }

  // Now you can use `plansList` as needed
  // console.log(plansList);
  res.status(200).json({invoiceList });
})

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
  const { planName, ratePerUnit, planType, prepaidBalance, billingCycle } = req.body;

  let plan = new Plan(planName,ratePerUnit,planType)

  try {
    // Create the new plan in the database
    plan = await prisma.plan.create({
      data: {
        planName: planName,
        ratePerUnit: ratePerUnit,
        billingCycle:billingCycle,
        planId:plan.planId
      },
    });

    // If the plan is of type PREPAID
    if (planType === "PREPAID") {
      if (prepaidBalance === undefined) {
        return res
          .status(400)
          .json({ error: "Missing prepaidBalance for prepaid plan" });
      }

      const prepaidPlan = await prisma.prepaidPlan.create({
        data: {
          planId: plan.planId,
          unitsAvailable: prepaidBalance / ratePerUnit,  // Calculate units based on the balance
          prepaidBalance: prepaidBalance,
          billingCycle:billingCycle
        },
      });

      // Respond with the created plan and prepaid plan details
      return res.status(201).json({ plan, prepaidPlan });
    } 

    // If the plan is of type POSTPAID
    else if (planType === "POSTPAID") {
      if (!billingCycle) {
        return res
          .status(400)
          .json({ error: "Missing billingCycle for postpaid plan" });
      }

      const postpaidPlan = await prisma.postpaidPlan.create({
        data: {
          planId: plan.planId,
          unitsUsed: 0, // Initial units used is 0 for postpaid
          billingCycle: billingCycle,  // Add billing cycle
        },
      });

      // Respond with the created plan and postpaid plan details
      return res.status(201).json({ plan, postpaidPlan });
    } 
    
    // If the planType is invalid, throw an error
    else {
      return res.status(400).json({ error: "Invalid plan type" });
    }
  } catch (error) {
    console.error("Error adding plan: ", error);
    return res.status(500).json({ error: "Internal server error" });
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

/**
 * @swagger
 * /admin/useUnits:
 *   post:
 *     summary: Use units for a customer's postpaid plan
 *     tags:
 *       - Misc
 *     description: Deducts a random number of units between 100 and 500 (in multiples of 5) for a customer with an active postpaid plan.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerMail
 *             properties:
 *               customerMail:
 *                 type: string
 *                 description: The email address of the customer.
 *                 example: johndoe@example.com
 *     responses:
 *       200:
 *         description: Successfully updated units used for the postpaid plan.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: ID of the postpaid plan.
 *                 planId:
 *                   type: integer
 *                   description: ID of the plan.
 *                 unitsUsed:
 *                   type: integer
 *                   description: The updated units used.
 *                 billingCycle:
 *                   type: string
 *                   description: The billing cycle of the postpaid plan.
 *                 plan:
 *                   type: object
 *                   properties:
 *                     planName:
 *                       type: string
 *                       description: Name of the plan.
 *       400:
 *         description: Customer does not have a postpaid plan active.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: customer does not have a postpaid plan active
 *       404:
 *         description: Customer does not exist.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: customer does not exist
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Internal server error
 */
app.post("/admin/useUnits", async (req,res)=>{

  const {customerMail} = req.body
  let customer = await prisma.customer.findUnique({
    where:{
      customerMail
    }
  })
  let planId = customer.customerCurrPlan
  let plan = await prisma.plan.findUnique({
    where:{
      planId
    },
    include: {
      prepaidPlans: false,
      postpaidPlans: true,
    },
  })
  if(!plan){
    res.status(400).json({error:"customer does not have a postpaid plan active"})
  }
  if(!customer){
    res.status(404).json({error:"customer does not exist"})
  }

  if(plan.postpaidPlans.length>0){
    const randomNum = Math.floor(Math.random() * (401 / 5)) * 5 + 100;
    let planInstance = plan.postpaidPlans[0]
    planInstance.unitsUsed = randomNum
    await prisma.postpaidPlan.update({
      where: { id:planInstance.id },
      data: { unitsUsed:randomNum }, // Assuming 'plan.planId' is the unique identifier for the plan
    });
  }
  res.status(200)
  res.send(JSON.stringify(plan.postpaidPlans[0]))
})

/**
 * @swagger
 * /prepaidPlans:
 *   get:
 *     summary: Retrieve a list of prepaid plans
 *     description: Fetch all prepaid plans from the database, including related plan data.
 *     tags:
 *       - Plans
 *     responses:
 *       200:
 *         description: A list of prepaid plans with their details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 prepaidPlans:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: The prepaid plan ID
 *                         example: 1
 *                       planId:
 *                         type: integer
 *                         description: The related plan ID
 *                         example: 101
 *                       unitsAvailable:
 *                         type: integer
 *                         description: The number of units available
 *                         example: 1000
 *                       prepaidBalance:
 *                         type: number
 *                         description: The prepaid balance
 *                         example: 50.75
 *                       planName:
 *                         type: string
 *                         description: The name of the plan
 *                         example: "Basic Prepaid Plan"
 *                       planDescription:
 *                         type: string
 *                         description: The description of the plan
 *                         example: "This plan offers 1000 units with a balance of $50.75."
 *       404:
 *         description: No prepaid plans found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "No prepaid plans found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
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

/**
 * @swagger
 * /postpaidPlans:
 *   get:
 *     summary: Retrieve a list of postpaid plans
 *     description: Fetch all postpaid plans from the database, including related plan data.
 *     tags:
 *       - Plans
 *     responses:
 *       200:
 *         description: A list of postpaid plans with their details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 postpaidPlans:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: The postpaid plan ID
 *                         example: 1
 *                       planId:
 *                         type: integer
 *                         description: The related plan ID
 *                         example: 101
 *                       unitsUsed:
 *                         type: integer
 *                         description: The number of units used
 *                         example: 500
 *                       billingCycle:
 *                         type: string
 *                         description: The billing cycle of the postpaid plan
 *                         example: "Monthly"
 *                       planName:
 *                         type: string
 *                         description: The name of the plan
 *                         example: "Unlimited Talk & Text"
 *                       planDescription:
 *                         type: string
 *                         description: The description of the plan
 *                         example: "This plan offers unlimited talk and text with 5GB of data."
 *       404:
 *         description: No postpaid plans found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "No postpaid plans found"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Internal server error"
 */
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

/**
 * @swagger
 * /viewPlan:
 *   post:
 *     summary: Retrieve a specific plan by ID
 *     description: Fetches a plan from the database using the provided plan ID.
 *     tags:
 *       - Plans
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               planId:
 *                 type: int
 *                 description: The ID of the plan to retrieve
 *                 example: 157158973
 *     responses:
 *       201:
 *         description: Successfully retrieved the plan
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 plan:
 *                   type: object
 *                   description: The plan object
 *                   example: { "planId": "12345", "name": "Sample Plan", "details": "Plan details here" }
 *       400:
 *         description: Bad request
 *       404:
 *         description: Plan not found
 */
app.post("/viewPlan",async (req,res)=>{

  const {planId} = req.body
  let plan = await prisma.plan.findUnique({
    where:{
      planId:planId
    }
  })

  res.status(201).json({plan})
})

app.get('/downloadInvoice/:invoiceId', async (req, res) => {
  const { invoiceId } = req.params;

  try {
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceId: parseInt(invoiceId) },
      include: { customer: true, plan: true },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Create a new PDF document
    const doc = new PDFDocument();

    // Set response headers to indicate a file download
    res.setHeader('Content-Disposition', `attachment; filename=invoice_${invoiceId}.pdf`);
    res.setHeader('Content-Type', 'application/pdf');

    // Pipe the PDF into the response
    doc.pipe(res);

    // Set up PDF metadata
    doc.info.Title = `Invoice`;
    doc.fontSize(14).text(`Invoice`, { align: 'center', margin: 10 });

    doc.info.Author = 'TELSTAR';

    // Add the company logo (optional, if you have one)
    // doc.image('path/to/logo.png', 50, 45, { width: 50 });
    
    // Add company information
    doc
      .fontSize(20)
      .text('TELSTAR', { align: 'center' })
      .fontSize(10)
      .text('30th Main Road', { align: 'center' })
      .text('Bengaluru, Karnataka, 560102', { align: 'center' })
      .text('Phone: 6263528833', { align: 'center' })
      .moveDown(2);

    // Invoice title
    doc
      .fontSize(18)
      .text(`InvoiceId:- #${invoiceId}`, { align: 'center', underline: true })
      .moveDown(1);

    // Customer Information
    doc
      .fontSize(12)
      .text('Customer Information:', { underline: true })
      .moveDown(0.5)
      .fontSize(10)
      .text(`Name: ${invoice.customer.customerName}`)
      .text(`Email: ${invoice.customer.customerMail}`)
      .text(`Phone: ${invoice.customer.customerPhone}`)
      .moveDown(1);

    // Plan Information
    doc
      .fontSize(12)
      .text('Plan Information:', { underline: true })
      .moveDown(0.5)
      .fontSize(10)
      .text(`Plan Name: ${invoice.plan.planName}`)
      .text(`Description: ${invoice.plan.description}`)
      .text(`Billing Cycle: ${invoice.plan.billingCycle}`)
      .moveDown(1);

    // Invoice Details
    doc
      .fontSize(12)
      .text('Invoice Details:', { underline: true })
      .moveDown(0.5)
      .fontSize(10)
      .text(`Date: ${invoice.date.toDateString()}`)
      .text(`Units: ${invoice.units}`)
      .text(`Amount: $${invoice.amount.toFixed(2)}`)
      .text(`Status: ${invoice.status}`)
      .moveDown(2);

    // Footer
    doc
      .fontSize(10)
      .text('Thank you for your business!', { align: 'center' });

    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});