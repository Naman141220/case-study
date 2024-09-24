const dotenv = require('dotenv');
const { execSync } = require('child_process');

module.exports = async () => {
  dotenv.config({ path: '.env.test' });

  // Run migrations on the test database
  execSync('npx prisma migrate deploy --schema=./prisma/schema.prisma', { stdio: 'inherit' });
};
