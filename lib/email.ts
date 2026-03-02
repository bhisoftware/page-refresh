/**
 * Email notification stubs.
 *
 * TODO: Wire these to Resend (https://resend.com) or SendGrid
 * once email templates are designed.
 */

export async function sendPaymentConfirmation(
  email: string,
  refreshId: string,
): Promise<void> {
  // TODO: Replace with actual email sending via Resend/SendGrid
  console.log(
    `[EMAIL STUB] Payment confirmation → ${email} for refresh ${refreshId}`,
  );
}

export async function sendBookingConfirmation(
  email: string,
  refreshId: string,
  date: string,
  timeSlot: string,
): Promise<void> {
  // TODO: Replace with actual email sending via Resend/SendGrid
  console.log(
    `[EMAIL STUB] Booking confirmation → ${email} for refresh ${refreshId}, ${date} ${timeSlot}`,
  );
}
