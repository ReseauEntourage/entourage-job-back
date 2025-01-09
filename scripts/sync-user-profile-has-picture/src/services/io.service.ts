import readline from 'readline';

export class IOService {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  waitForInput(promptText: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(promptText, (input) => {
        resolve(input);
        this.rl.close();
      });
    });
  }
}
