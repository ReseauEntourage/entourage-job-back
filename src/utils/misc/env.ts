import path from 'path';
import dotenv from 'dotenv';

/**
 * load environement variables located in ./.env or ./env.dev-test depending on NODE_ENV
 */
export function loadEnvironementVariables() {
  const envPath =
    process.env.NODE_ENV === 'dev-test'
      ? '../../../.env.test'
      : '../../../.env';
  const completePath = path.resolve(__dirname, envPath);
  dotenv.config({ path: completePath });
}
