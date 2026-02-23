// Stripe webhook example (Node + Express)
// Install: npm i express stripe

import express from 'express';
import Stripe from 'stripe';

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2022-11-15' });

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig || '', webhookSecret);
    // Handle event types
    if (event.type === 'payment_intent.succeeded') {
      console.log('Payment succeeded');
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

app.listen(3000);
