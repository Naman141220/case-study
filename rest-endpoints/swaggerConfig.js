import swaggerJSDoc from 'swagger-jsdoc';


const options = {
  definition: {
    swagger: '2.0',
    info: {
      title: 'Telecom-Billing-System',
      version: '1.0.0',
      description: 'A description of your API',
    },
  },
  apis: ['./index.js'], // Path to the API docs
};

const swaggerSpec = swaggerJSDoc(options);

export default swaggerSpec
