// import LinkedList from './LinkedList.js'
import { LinkedList, Node } from "./LinkedList.js";

class Customer {
  constructor(customerName,customerMail,customerPhone,customerPassword) {
    this.customerId = Math.floor(100000000 + Math.random() * 900000000);
    this.customerName = customerName
    this.customerMail = customerMail
    this.customerPhone = customerPhone
    this.customerPassword = customerPassword
    this.customerCurrPlan = null;
    this.invoices = Array;
  }

  addInvoice(customerId) {
    let invoice = new Invoice(customerId);
    return invoice;
  }

  viewCurrPlan(customerId) {
    return this.invoices[(this.invoices.length - 1)];
  }

  viewPrevPlan(customerId) {
    return this.invoices[(this.invoices.length - 2)];
  }

  // viewInvoice(customerId,invoiceId){
  //     return
  // }
}

// class CustomerList {
//     constructor() {
//         this.custList = new LinkedList();
//     }

//     insertCustomer(customerName, customerMail, customerPhone, customerType) {
//         let customer = new Customer();
//         customer.customerName = customerName;
//         customer.customerMail = customerMail;
//         customer.customerPhone = customerPhone;
//         customer.customerType = customerType;
//         this.custList.insertAtBegin(customer, customer.customerId);
//         return this.custList.head;
//     }
// }

// Base Plan class
class Plan {
  constructor(planName, ratePerUnit, planType) {
    this.planId = Math.floor(100000000 + Math.random() * 900000000);
    this.planName = planName;
    this.ratePerUnit = ratePerUnit;
    this.planType = planType;
  }

  calculateCharge(units) {
    return units * this.ratePerUnit;
  }
}



// PrepaidPlan subclass
class PrepaidPlan extends Plan {
  constructor(planName, ratePerUnit, prepaidBalance, unitsAvailable) {
    super(planName, ratePerUnit, "PREPAID");
    this.prepaidBalance = prepaidBalance;
    this.unitsAvailable = unitsAvailable;
  }

  deductBalance(units) {
    const charge = this.calculateCharge(units);
    if (this.prepaidBalance >= charge) {
      this.prepaidBalance -= charge;
      return charge;
    } else {
      throw new Error("Insufficient balance");
    }
  }
}


// PostpaidPlan subclass
class PostpaidPlan extends Plan {
  constructor(planName, ratePerUnit, billingCycle, unitsUsed = 0) {
    super(planName, ratePerUnit, "POSTPAID");
    this.billingCycle = billingCycle;
    this.unitsUsed = unitsUsed;
  }

  generateBill(units) {
    return this.calculateCharge(units);
  }
}


// Invoice class
class Invoice {
  constructor(customerName, customerId, plan, units = 0, date, planType, amount) {
    this.invoiceId = Math.floor(100000000 + Math.random() * 900000000);
    this.customerId = customerId;
    this.customerName = customerName;
    this.plan = plan;
    this.units = units;
    this.date = date;
    this.planType = planType;
    this.amount = amount;
  }

  calculateAmount() {
    if (this.planType === "PREPAID") {
      return this.plan.deductBalance(this.units);
    } else if (this.planType === "POSTPAID") {
      return this.plan.generateBill(this.units);
    } else {
      throw new Error("Invalid plan type");
    }
  }
}




// Example usage
const prepaidPlan = new PrepaidPlan();

// class Prepaid extends Invoice {
//     constructor(customerId, customerName, amount, date, prepaidBalance) {
//         super(customerId, customerName, amount, date);
//         this.prepaidBalance = prepaidBalance;
//     }
// }

// class Postpaid extends Invoice {
//     constructor(customerId, customerName, amount, date, dueDate) {
//         super(customerId, customerName, amount, date);
//         this.dueDate = dueDate;
//     }
// }

// const prepaidInvoice = new Prepaid(1, "John Doe", 100.0, new Date(), 50.0);
// console.log(prepaidInvoice.invoiceId); // This will print the generated invoiceId
// console.log(prepaidInvoice.invoiceId); // This will print the generated invoiceId

// const postpaidInvoice = new Postpaid(2, "Jane Doe", 200.0, new Date(), new Date('2024-10-01'));
// console.log(postpaidInvoice.invoiceId); // This will print the generated invoiceId
// let i = new Invoice("1213","123213")
// console.log(i.invoiceId)
export { Customer, Invoice, Plan, PostpaidPlan, PrepaidPlan };

// let a = new Customer()
// let cl = new CustomerList()
// let cl_head = cl.insertCustomer('naman','dslajf',213213,'pre')
// cl_head = cl.insertCustomer('shivu','asdfsp',8723,'post')
// // cl.custList.printToEnd(cl_head)
// console.log(cl_head.obj.customerId)
