/** An error we expect (bad input, not logged in...). Its message is safe to show the user. */
export class AppError extends Error {
  status: number;
  expected = true;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
