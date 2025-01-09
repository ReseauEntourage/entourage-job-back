/* eslint-disable no-console */

import { colorsConfig } from '../config/colorConfig';

export const printMessage = (
  message: string,
  type: keyof typeof colorsConfig = 'neutral',
  resetLine = false
) => {
  const color = colorsConfig[type];
  if (resetLine) {
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
  }
  process.stdout.write(`${color} ${message} ${colorsConfig.reset}`);
};
