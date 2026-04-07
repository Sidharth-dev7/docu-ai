// docu-ai/tests/services/email.test.js
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  })),
}));

const nodemailer = require('nodemailer');
const { sendDraftEmail } = require('../../services/email');

process.env.EMAIL_HOST = 'smtp.test.com';
process.env.EMAIL_PORT = '587';
process.env.EMAIL_USER = 'bot@test.com';
process.env.EMAIL_PASS = 'pass';

test('sendDraftEmail calls sendMail with correct recipient', async () => {
  await sendDraftEmail({
    to: 'writer@company.com',
    productName: 'Product A',
    version: '2.1.0',
    confluenceUrl: 'https://confluence.example.com/pages/999',
  });

  const transport = nodemailer.createTransport.mock.results[0].value;
  const call = transport.sendMail.mock.calls[0][0];
  expect(call.to).toBe('writer@company.com');
  expect(call.subject).toContain('Product A');
  expect(call.subject).toContain('2.1.0');
  expect(call.html).toContain('https://confluence.example.com/pages/999');
});
