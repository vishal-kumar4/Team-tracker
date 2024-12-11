const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.EMAIL_API_KEY);

/**
 * Send an email using SendGrid.
 *
 * @param {string} to - Recipient email address.
 * @param {string} subject - Subject of the email.
 * @param {string} message - Email message (text).
 * @param {string} [from='vishal@beingzero.in'] - Sender email address (default: 'vishal@beingzero.in').
 * @param {string[]} [cc=['vishalkuma@gmail.com']] - CC email addresses (default: ['vishalkuma@gmail.com']).
 */
const sendEmail = async (to, subject, message, htmlMessage="", from = 'vishal@beingzero.in', cc = ['vishalkuma@gmail.com']) => {
  if (!to || !subject || !message) {
    throw new Error("Missing required fields: 'to', 'subject', or 'message'.");
  }

  const msg = {
    to: to,
    from: from,
    cc: cc,
    subject: subject,
    text: message,
    html: htmlMessage,
  };

  try {
    await sgMail.send(msg);
    console.log('Email sent successfully');
  } catch (error) {
    console.error('Error sending email:', error.response ? error.response.body : error.message);
  }
};

module.exports = sendEmail;
