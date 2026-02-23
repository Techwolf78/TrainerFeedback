import emailjs from '@emailjs/browser';

/**
 * Initializes EmailJS with the public key from environment variables.
 * This is safe to call multiple times, but usually only needed once per session.
 */
const initEmailJs = () => {
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
  if (!publicKey) {
    console.warn('EmailJS Public Key is missing from environment variables.');
    return;
  }
  emailjs.init(publicKey);
};

/**
 * Sends an onboarding email to a newly created Trainer.
 * @param {Object} params
 * @param {string} params.name The full name of the trainer
 * @param {string} params.email The email address of the trainer
 * @param {string} params.temporary_password The temporary password generated for the trainer
 */
export const sendTrainerOnboardingEmail = async ({ name, email, temporary_password }) => {
  try {
    initEmailJs();

    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID_TRAINER;

    if (!serviceId || !templateId) {
      console.warn('EmailJS Service ID or Trainer Template ID is missing. Skipping trainer onboarding email.');
      return false;
    }

    const templateParams = {
      trainer_name: name,
      email: email,
      temporary_password: temporary_password,
    };

    const response = await emailjs.send(serviceId, templateId, templateParams);
    console.log('Trainer onboarding email sent successfully:', response.status, response.text);
    return true;
  } catch (error) {
    console.error('Failed to send trainer onboarding email:', error);
    // We do not throw here to prevent breaking the overall user creation flow
    return false;
  }
};

/**
 * Sends an onboarding email to a newly created College Admin.
 * @param {Object} params
 * @param {string} params.name The full name of the admin
 * @param {string} params.email The email address of the admin
 * @param {string} params.temporary_password The temporary password generated for the admin
 */
export const sendAdminOnboardingEmail = async ({ name, email, temporary_password }) => {
  try {
    initEmailJs();

    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID_ADMIN;

    if (!serviceId || !templateId) {
      console.warn('EmailJS Service ID or Admin Template ID is missing. Skipping admin onboarding email.');
      return false;
    }

    const templateParams = {
      admin_name: name,
      email: email,
      temporary_password: temporary_password,
    };

    const response = await emailjs.send(serviceId, templateId, templateParams);
    console.log('Admin onboarding email sent successfully:', response.status, response.text);
    return true;
  } catch (error) {
    console.error('Failed to send admin onboarding email:', error);
    // We do not throw here to prevent breaking the overall user creation flow
    return false;
  }
};

/**
 * Sends an onboarding email to a newly created Superadmin.
 * @param {Object} params
 * @param {string} params.name The full name of the superadmin
 * @param {string} params.email The email address of the superadmin
 * @param {string} params.temporary_password The temporary password generated for the superadmin
 */
export const sendSuperAdminOnboardingEmail = async ({ name, email, temporary_password }) => {
  try {
    initEmailJs();

    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID_SUPERADMIN;

    if (!serviceId || !templateId) {
      console.warn('EmailJS Service ID or SuperAdmin Template ID is missing. Skipping superadmin onboarding email.');
      return false;
    }

    const templateParams = {
      admin_name: name,
      email: email,
      temporary_password: temporary_password,
    };

    const response = await emailjs.send(serviceId, templateId, templateParams);
    console.log('Superadmin onboarding email sent successfully:', response.status, response.text);
    return true;
  } catch (error) {
    console.error('Failed to send superadmin onboarding email:', error);
    return false;
  }
};
