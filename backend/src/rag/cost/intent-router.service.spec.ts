import { IntentRouterService } from './intent-router.service';

describe('IntentRouterService', () => {
  const router = new IntentRouterService();

  it.each([
    ['hi', 'greeting'],
    ['Hello!', 'greeting'],
    ['hey there', 'greeting'],
    ['Hiii', 'greeting'],
    ['Good morning', 'greeting'],
    ['how are you?', 'wellbeing'],
    ['thanks', 'gratitude'],
    ['Thank you so much!', 'gratitude'],
    ['thx', 'gratitude'],
    ['ok', 'acknowledgement'],
    ['okay cool', 'acknowledgement'],
    ['got it', 'acknowledgement'],
    ['👍', 'acknowledgement'],
    ['bye', 'farewell'],
    ['good night', 'farewell'],
    ['see you later', 'farewell'],
  ])('routes %p as %p', (message, intent) => {
    expect(router.route(message)?.intent).toBe(intent);
  });

  it.each([
    'hi, what is the refund policy?',
    'thanks, and how many vacation days do I get?',
    'What does chapter 3 say about mitochondria?',
    'ok so explain the onboarding process',
    'summarize the document',
    '',
  ])('does not intercept real questions: %p', (message) => {
    expect(router.route(message)).toBeNull();
  });
});
