# Telecom Billing System API

This API provides endpoints for managing customers, plans, invoices, and other telecom-related operations.

## Endpoints

### 1. Register a new customer

POST /register
json { "name": "John Doe", "email": "john@example.com", "password": "password123", "phone": "1234567890" }

### 2. Login a customer

POST /login

json { "email": "john@example.com", "password": "password123" }

### 3. Generate an invoice for a customer

POST /generateInvoice

json { "customerMail": "john@example.com" }

### 4. Buy a plan for a customer

POST /buyPlan

json { "customerMail": "john@example.com", "planName": "Basic Plan", "planType": "PREPAID" }

### 5. View plan history of a customer

POST /viewHistory

json { "customerMail": "john@example.com" }

### 6. Add a new plan (Admin)

POST /admin/addPlan

json { "planName": "Premium Plan", "ratePerUnit": 0.05, "planType": "PREPAID", "prepaidBalance": 100, "billingCycle": "MONTHLY" }

### 7. Add a new customer (Admin)

POST /admin/addCustomer

json[ { "customerName": "Jane Smith", "customerMail": "jane@example.com", "customerPhone": "+1234567890" }](https://meet.google.com/uqq-oond-bmp)

### 8. Get invoices for a customer

POST /invoices

json { "customerMail": "john@example.com" }

### 9. Get invoice by ID

GET /invoices/:invoiceId

Replace `:invoiceId` with the actual invoice ID.

### 10. Pay an invoice

POST /payInvoice

json { "invoiceId": 12345 }

### 11. Use units for a customer's postpaid plan (Admin)

POST /admin/useUnits

json { "customerMail": "john@example.com" }

### 12. Retrieve a list of prepaid plans

GET /prepaidPlans

### 13. Retrieve a list of postpaid plans

GET /postpaidPlans

### 14. Retrieve a specific plan by ID

POST /viewPlan

json { "planId": 157158973 }

## Notes

- All endpoints require appropriate authentication and authorization.
- The `planType` field in the `/buyPlan` endpoint should be either "PREPAID" or "POSTPAID".
- The `planType` field in the `/admin/addPlan` endpoint should be either "PREPAID" or "POSTPAID".
- For prepaid plans, `prepaidBalance` is required. For postpaid plans, `billingCycle` is required.
- The `customerMail` field is used as the unique identifier for customers in most endpoints.
- Error responses and detailed success responses are not included in these examples for brevity.

## Running the API

1. Install dependencies: `npm install`
2. Start the server: `node index.js`
3. The API will be available at `http://localhost:9099`

## API Documentation

Detailed API documentation is available at `/api-docs` when the server is running.

## Environment Variables

Make sure to set the following environment variables:

- `DATABASE_URL`: The connection string for your MySQL database
- `JWT_SECRET`: A secret key for JWT token generation

These can be set in a `.env` file or in your system's environment variables.
This README.md file provides a comprehensive overview of the API endpoints, including example inputs for each endpoint. It also includes information about running the API, API documentation, and environment variables. The examples are based on the schema provided in the schema.prisma file.
