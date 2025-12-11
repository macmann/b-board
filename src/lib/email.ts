export const sendEmail = async (to: string, subject: string, html: string) => {
  // Placeholder implementation. Replace with a real mailer (e.g., Nodemailer) when available.
  const from = process.env.EMAIL_FROM || "no-reply@bboard.local";

  console.info(`Sending email from ${from} to ${to}: ${subject}`);
  console.debug(html);
};

export default sendEmail;
